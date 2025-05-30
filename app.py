import os, subprocess, io
from flask import Flask, request, jsonify, render_template, send_from_directory, session, send_file
from google.cloud import storage
from werkzeug.utils import secure_filename
from take_prompts import generate_gpt_response
import psycopg2
from dotenv import load_dotenv
from pinecone import Pinecone

app = Flask(__name__, static_folder='static', template_folder='templates')

app.secret_key = os.urandom(24) #random session ID

# Load environment variables
load_dotenv()

DB_HOST = os.environ.get("DB_HOST")
DB_NAME = os.environ.get("DB_NAME")
DB_USER = os.environ.get("DB_USER")
DB_PASS = os.environ.get("DB_PASS")

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

bucket_name = "ai-tutor-docs-bucket" 

# Initialize Google Cloud Storage client
storage_client = storage.Client()
bucket = storage_client.bucket(bucket_name)

# Ensure the "admin" folder exists in the bucket
def ensure_user_folder_exists():
    blob = bucket.blob(session.get('folder_prefix')+'/')
    if not blob.exists():
        blob.upload_from_string("", content_type="application/x-www-form-urlencoded")

# Check if a file has an allowed extension
ALLOWED_EXTENSIONS = {'pdf', 'pptx'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('home.html')

@app.route('/student')
def student():
    return render_template('student.html')

@app.route('/proctor')
def proctor():
    return render_template('proctor.html')

# Upload file endpoint
@app.route('/upload', methods=['POST'])
def upload_file():
    # Check for file and course parameters
    if 'file' not in request.files:
        return jsonify(success=False, message="No file part")
    
    course = request.form.get('course')  # Get course from form data
    if not course:
        return jsonify(success=False, message="No course specified")

    file = request.files['file']
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Construct the file path with course included
        file_path = f"{session.get('folder_prefix')}/{course}/{filename}"

        # Upload the file to the bucket
        blob = bucket.blob(file_path)
        blob.upload_from_file(file)

        # Upload the file to Pinecone
        try:
            subprocess.run(['python', 'train/read_docs.py',
                            session.get('username'), 
                            course, 
                            str(session.get('id'))], 
                            check=True)
        except subprocess.CalledProcessError as e:
            return jsonify(success=False, message=f"File uploaded but Pinecone ingestion failed: {str(e)}")
        return jsonify(success=True, message="File uploaded")
    
    return jsonify(success=False, message="Invalid file")

@app.route('/load-docs', methods=['GET'])
def load_docs():
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)

    folder_prefix = session.get('folder_prefix')
    course_name = request.args.get('course')  # <-- get selected course

    if not folder_prefix or not course_name:
        return jsonify({'error': 'Missing folder prefix or course name'}), 400

    # Combine to target specific course folder
    course_path_prefix = f"{folder_prefix}/{course_name}/"
    blobs = bucket.list_blobs(prefix=course_path_prefix)

    valid_extensions = ['pdf', 'pptx']
    file_list = [
        {
            'name': blob.name.replace(course_path_prefix, ''),  # remove folder path
            'type': 'pdf' if blob.name.endswith('.pdf') else 'pptx'
        }
        for blob in blobs
        if not blob.name.endswith('/') and blob.name.split('.')[-1] in valid_extensions
    ]

    return jsonify(file_list)

# Is this ever even used?
@app.route('/docs/<filename>')
def get_doc(filename):
    # Serve file from bucket
    blob = bucket.blob(f"{session.get('folder_prefix')}{filename}")
    if blob.exists():
        file_data = blob.download_as_bytes()
        response = send_from_directory(file_data, mimetype='application/pdf' if filename.endswith('.pdf') else 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
        return response
    return jsonify(success=False, message="File not found"), 404

# Delete file endpoint
@app.route('/delete', methods=['DELETE'])
def delete_file():
    file_name = request.args.get('file')
    course = request.args.get('course')

    if not file_name:
        return jsonify(success=False, message="No file specified")
    if not course:
        return jsonify(success=False, message="No course specified")

    file_path = f"{session.get('folder_prefix')}/{course}/{file_name}"
    blob = bucket.blob(file_path)

    gcs_deleted = False
    pinecone_deleted = False

    # Attempt to delete from GCS
    if blob.exists():
        blob.delete()
        gcs_deleted = True

    # Attempt to delete from Pinecone
    try:
        index_name = "ai-tutor-index"
        index = pc.Index(index_name)

        # Delete vectors by metadata filter
        index.delete(
            filter={"filename": file_name, "course_name": course},
            namespace=course
        )
        pinecone_deleted = True
    except Exception as e:
        return jsonify(success=False, message=f"GCS deleted: {gcs_deleted}, but error deleting from Pinecone: {str(e)}")

    return jsonify(success=True, message=f"GCS deleted: {gcs_deleted}, Pinecone deleted: {pinecone_deleted}")

# Not tested or implemented
@app.route('/download')
def download_file():
    file_name = request.args.get('file')
    course = request.args.get('course')

    if not file_name or not course:
        return jsonify(success=False, message="Missing file or course"), 400

    folder_prefix = session.get('folder_prefix')
    if not folder_prefix:
        return jsonify(success=False, message="No folder prefix in session"), 400

    blob_path = f"{folder_prefix}/{course}/{file_name}"
    blob = bucket.blob(blob_path)

    if not blob.exists():
        return jsonify(success=False, message="File not found in bucket"), 404

    # Download file content into memory
    file_data = blob.download_as_bytes()
    file_stream = io.BytesIO(file_data)

    # Determine content type (you could also guess with `mimetypes`)
    content_type = 'application/pdf' if file_name.endswith('.pdf') else 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

    return send_file(file_stream,
                     as_attachment=True,
                     download_name=file_name,
                     mimetype=content_type)

# Train model endpoint
@app.route("/train", methods=["POST"])
def train_model():
    try:
        # Get session and request data
        username = session.get("username")  # Proctor's username
        proctor_id = session.get("id")  # Proctor's ID
        if not username or not proctor_id:
            return jsonify({"success": False, "message": "User not logged in or proctor ID missing"}), 401
        
        data = request.get_json()
        course_name = data.get("course_name")
        if not course_name:
            return jsonify({"success": False, "message": "Course name is required"}), 400

        # Run the training script with username, course_name, and proctor_id
        subprocess.run(['python', 'train/read_docs.py', username, course_name, str(proctor_id)], check=True)

        return jsonify({"success": True, "message": f"Training completed successfully for course {course_name}!"}), 200
    except subprocess.CalledProcessError as e:
        return jsonify({"success": False, "message": f"Training script error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"success": False, "message": f"Error occurred: {str(e)}"}), 500

@app.route('/assign-student', methods=['POST'])
def assign_student():
    """
    Assign a student to a course.
    """
    try:
        data = request.get_json()
        student_username = data.get('username')
        course_name = data.get('course_name')
        proctor_id = session.get('id')  # Ensure proctor is logged in
        
        if not (student_username and course_name and proctor_id):
            return jsonify({'success': False, 'message': 'Missing required parameters.'}), 400

        # Fetch the student ID
        student_query = "SELECT id FROM users WHERE username = %s AND role = 0"
        course_query = """SELECT c.id 
                            FROM courses c 
                            JOIN user_courses uc ON c.id = uc.courseId 
                            JOIN users u ON u.id = uc.userId 
                            WHERE c.name = %s AND u.id = %s AND u.role = 1"""
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(student_query, (student_username,))
                student_row = cursor.fetchone()
                if not student_row:
                    return jsonify({'success': False, 'message': 'Student not found.'}), 404
                student_id = student_row[0]

                cursor.execute(course_query, (course_name, proctor_id))
                course_row = cursor.fetchone()
                if not course_row:
                    return jsonify({'success': False, 'message': 'Course not found.'}), 404
                course_id = course_row[0]

                # Insert into Student_Courses table
                insert_query = """
                INSERT INTO user_courses (userId, courseId) 
                VALUES (%s, %s)
                """
                cursor.execute(insert_query, (student_id, course_id))

            conn.commit()

        return jsonify({'success': True, 'message': 'Student assigned successfully.'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# Student-specific API for asking questions
@app.route('/ask-question', methods=['POST'])
def ask_question():
    try:
        data = request.get_json()
        student_id = session.get('id')
        course_name = data.get('courseName')
        question = data.get('question')

        if not (student_id and course_name and question):
            return jsonify({'success': False, 'message': 'Missing required parameters.'}), 400

        # Call the generate_gpt_response function
        tutor_response = generate_gpt_response(student_id, course_name, question)
        
        return jsonify({'success': True, 'response': tutor_response}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/get-courses', methods=['GET'])
def get_courses():
    proctor_id = session.get("id")
    if not proctor_id:
        return jsonify(success=False, message="Unauthorized"), 401

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""SELECT c.id, c.name 
                       FROM courses c 
                       JOIN user_courses uc ON c.id = uc.courseId 
                       JOIN users u ON uc.userId = u.id 
                       WHERE u.id = %s""", (proctor_id,))
        courses = cursor.fetchall()
        # Return a list of courses as JSON
        return jsonify(success=True, courses=[{"id": row[0], "name": row[1]} for row in courses])
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/get-messages', methods=['GET'])
def get_courses():
    proctor_id = session.get("id")
    if not proctor_id:
        return jsonify(success=False, message="Unauthorized"), 401

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""SELECT c.id, c.name 
                       FROM courses c 
                       JOIN user_courses uc ON c.id = uc.courseId 
                       JOIN users u ON uc.userId = u.id 
                       WHERE u.id = %s""", (proctor_id,))
        courses = cursor.fetchall()
        # Return a list of courses as JSON
        return jsonify(success=True, courses=[{"id": row[0], "name": row[1]} for row in courses])
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500
    finally:
        cursor.close()
        conn.close()

        
@app.route('/get-student-courses', methods=['GET'])
def get_student_courses():
    try:
        student_id = session.get('id')

        if not student_id:
            return jsonify({'success': False, 'message': 'Student not logged in.'}), 403

        query = """
        SELECT c.id, c.name 
        FROM courses c 
        INNER JOIN user_courses uc ON c.id = uc.courseId 
        INNER JOIN users u ON uc.userId = u.id 
        WHERE u.id = %s AND u.role = 0
        """
        with get_db_connection().cursor() as cursor:
            cursor.execute(query, (student_id,))
            courses = [{'id': row[0], 'name': row[1]} for row in cursor.fetchall()]

        return jsonify({'success': True, 'courses': courses}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/add-course', methods=['POST'])
def add_course():
    # Get the proctor ID and folder prefix from the session
    proctor_id = session.get("id")
    folder_prefix = session.get("folder_prefix")

    if not proctor_id or not folder_prefix:
        return jsonify(success=False, message="Unauthorized"), 401

    # Get the new course name from the request
    data = request.json
    course_name = data.get("name", '')
    if not course_name:
        return jsonify(success=False, message="Course name is required"), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Insert the new course into the Courses table
        cursor.execute(
            "INSERT INTO courses (name, filepath) VALUES (%s, %s) RETURNING id",
            (course_name, f"{folder_prefix}{course_name}/")
        )
        course_id = cursor.fetchone()[0]

        # Associate the professor with the course
        cursor.execute(
            "INSERT INTO user_courses (userId, courseId) VALUES (%s, %s)",
            (proctor_id, course_id)
        )
        conn.commit()

        # Create filepath
        course_path = f"{folder_prefix}/{course_name}/"

        # Create the course folder in the bucket
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(course_path)
        if not blob.exists():
            blob.upload_from_string("", content_type="application/x-www-form-urlencoded")

        return jsonify(success=True, course={"id": course_id, "name": course_name, "filepath": course_path}), 200

    except Exception as e:
        conn.rollback()
        return jsonify(success=False, message=str(e)), 500
    finally:
        cursor.close()
        conn.close()


def get_db_connection():
    conn = psycopg2.connect(
        host=DB_HOST,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )
    return conn

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    role = data.get("role")  # Either "student" or "proctor"

    table = "Students" if role == "student" else "Proctors"
    conn = get_db_connection()
    cursor = conn.cursor()

    # TODO: Modify this to work only as a login and create a separate create account function
    try:
        # Check if user exists
        role_value = 0 if role == 'student' else 1
        cursor.execute("SELECT id, password FROM users WHERE username = %s AND role = %s", (username, role_value))
        user = cursor.fetchone()

        if user:
            # User exists, check password
            if user[1] == password:
                session["id"] = user[0] #first changing the session id and pass, making bucket if one doesnt exist
                session['username'] = username
                if role == 'proctor':
                    session['folder_prefix'] = f"{session.get('username')}_{session.get('id')}"
                    ensure_user_folder_exists()
                return jsonify({"success": True, "message": "Login successful", "route": f"/{role}"})
            else:
                return jsonify({"success": False, "message": "Incorrect password"}), 401
        else:
            # TODO: Modify this
            # Temporarily send message to create account
            return jsonify({"success": False, "message": "User does not exist, please create an account"}), 401
            # User doesn't exist, create account
            # # If this is reimplemented, it will need updated to match new database
            # cursor.execute(f"INSERT INTO {table} (username, password) VALUES (%s, %s) RETURNING id", (username, password)) 
            # user_id = cursor.fetchone()[0]  # Fetch the new ID
            # conn.commit()

            # session["id"] = user_id #first changing the session id and pass, making bucket if one doesnt exist
            # session['username'] = username
            # if role == 'proctor':
            #         session['folder_prefix'] = f"{session.get('username')}_{session.get('id')}"
            #         ensure_user_folder_exists()            
            # return jsonify({"success": True, "message": "Account created", "route": f"/{role}"})
    
    finally:
        # Ensure the cursor and connection are closed
        cursor.close()
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)