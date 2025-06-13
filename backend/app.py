import os, subprocess, io
from flask import Flask, request, jsonify, session, send_file
import logging
from flask_cors import CORS
from google.cloud import storage
from werkzeug.utils import secure_filename
from take_prompts import generate_gpt_response
import mysql.connector
from dotenv import load_dotenv
from pinecone import Pinecone
# Report generation
import datetime
from bs4 import BeautifulSoup
import re
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from wordcloud import WordCloud
import matplotlib.pyplot as plt
from io import BytesIO
import base64

stop_words = set(stopwords.words('english'))
custom_stop_words = {'like', 'lets', 'one', 'something', 'start', 'begin', 'try', 'trying', 'go', 'back', 'step', 'thing', 'another', 'keep', 'much', 'done', 'dont', 'doesnt', 'didnt', 'isnt', 'possible', 'different', 'suppose', 'used'}

app = Flask(__name__)
CORS(app, supports_credentials=True, origins=["http://localhost"])

app.secret_key = os.urandom(24) #random session ID

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

DB_HOST = os.environ.get("DB_HOST")
DB_NAME = os.environ.get("DB_NAME")
DB_USER = os.environ.get("DB_USER")
DB_PASS = os.environ.get("DB_PASS")
DB_PORT = os.environ.get("DB_PORT")

def get_db_connection():
    conn = mysql.connector.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        port=int(DB_PORT)
    )
    return conn

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

bucket_name = "ai-tutor-docs-bucket" 

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s %(levelname)s %(message)s')

# Initialize Google Cloud Storage client
storage_client = storage.Client()
bucket = storage_client.bucket(bucket_name)

# Check if a file has an allowed extension
ALLOWED_EXTENSIONS = {'pdf', 'pptx'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_user_info_from_headers():
    user_id = request.headers.get("X-User-Id")
    username = request.headers.get("X-Username")
    if (request.headers.get("X-User-Role") is None):
        user_role = 0  # Default to student role if not provided
    else:
        user_role = request.headers.get("X-User-Role")

    if not user_id or not username or user_role is None:
        return None, None, None, None
    
    folder_prefix = f"{username}_{user_id}"
    return user_id, username, int(user_role), folder_prefix

# Upload file endpoint
@app.route('/upload', methods=['POST'])
def upload_file():
    # Get user info from headers
    user_id, username, user_role, folder_prefix = get_user_info_from_headers()
    if not user_id or user_role != 1:
        return jsonify(success=False, message="Unauthorized"), 401
    
    # Check for file and course parameters
    if 'file' not in request.files:
        return jsonify(success=False, message="No file part")
    
    course = request.form.get('courseId')  # Get course from form data
    if not course:
        return jsonify(success=False, message="No course specified")

    file = request.files['file']
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Construct the file path with course included
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT filepath FROM courses WHERE id = %s", (course,))
        result = cursor.fetchone()
        conn.close()
        if not course:
            return jsonify(success=False, message="Course not found"), 404

        filepath = result['filepath']
        filepath = f"{filepath}{filename}"

        # Upload the file to the bucket
        blob = bucket.blob(filepath)
        blob.upload_from_file(file)

        # Upload the file to Pinecone
        try:
            subprocess.run(['python', 'read_docs.py',
                            username, 
                            course, 
                            user_id,
                            filename], 
                            check=True)
        except subprocess.CalledProcessError as e:
            return jsonify(success=False, message=f"File uploaded but Pinecone ingestion failed: {str(e)}")
        return jsonify(success=True, message="File uploaded")
    
    return jsonify(success=False, message="Invalid file")

@app.route('/load-docs', methods=['GET'])
def load_docs():
    print("Load docs endpoint hit")
    # Get user info from headers
    user_id, username, user_role, folder_prefix = get_user_info_from_headers()
    if not user_id or user_role != 1:
        return jsonify(success=False, message="Unauthorized"), 401
    
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)

    courseId = request.args.get('courseId')  # <-- get selected course

    if not folder_prefix or not courseId:
        return jsonify({'error': 'Missing folder prefix or course name'}), 400

    # Combine to target specific course folder
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT filepath FROM courses WHERE id = %s", (courseId,))
    result = cursor.fetchone()
    conn.close()
    if not courseId:
        return jsonify(success=False, message="Course not found"), 404

    filepath = result['filepath']

    blobs = bucket.list_blobs(prefix=filepath)

    valid_extensions = ['pdf', 'pptx']
    file_list = [
        {
            'name': blob.name.replace(filepath, ''),  # remove folder path
            'type': 'pdf' if blob.name.endswith('.pdf') else 'pptx'
        }
        for blob in blobs
        if not blob.name.endswith('/') and blob.name.split('.')[-1] in valid_extensions
    ]

    return jsonify(file_list)

# Delete file endpoint
@app.route('/delete', methods=['DELETE'])
def delete_file():
    # Get user info from headers
    user_id, username, user_role, folder_prefix = get_user_info_from_headers()
    if not user_id or user_role != 1:
        return jsonify(success=False, message="Unauthorized"), 401
    
    file_name = request.args.get('file')
    courseId = request.args.get('courseId')

    if not file_name:
        return jsonify(success=False, message="No file specified")
    if not courseId:
        return jsonify(success=False, message="No course specified")
    
    # Get course name from the courseId
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT name FROM courses WHERE id = %s", (courseId,))
    result = cursor.fetchone()
    conn.close()
    if result:
        course = result['name']
    else:
        return jsonify(success=False, message="Course not found"), 404

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT filepath FROM courses WHERE id = %s", (courseId,))
    result = cursor.fetchone()
    conn.close()
    if not courseId:
        return jsonify(success=False, message="Course not found"), 404

    filepath = result['filepath']
    filepath = f"{filepath}{file_name}"
    blob = bucket.blob(filepath)

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

        
        # Check if the index exists first
        existing_indexes = pc.list_indexes()

        if index_name in existing_indexes:
            index = pc.Index(index_name)
        
        # Create namespace
        namespace = f"{course}_{courseId}"

        # Delete vectors by metadata filter
        index.delete(
            filter={"filename": file_name, "course_name": course},
            namespace=namespace
        )
        pinecone_deleted = True
    except Exception as e:
        return jsonify(success=False, message=f"GCS deleted: {gcs_deleted}, but error deleting from Pinecone: {str(e)}")

    return jsonify(success=True, message=f"GCS deleted: {gcs_deleted}, Pinecone deleted: {pinecone_deleted}")

@app.route('/delete-course', methods=['DELETE'])
def delete_course():
    print("Delete course endpoint hit")
    # Get user info from headers
    user_id, username, user_role, folder_prefix = get_user_info_from_headers()
    if not user_id or user_role != 1:
        return jsonify(success=False, message="Unauthorized"), 401
    
    data = request.get_json()
    courseId = int(data['courseId'])
    print(f"Course ID: {courseId}")
    if not courseId:
        return jsonify(success=False, message="No course specified")
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT filepath FROM courses WHERE id = %s", (courseId,))
        result = cursor.fetchone()
        filepath = result['filepath'] if result else None
        print(f"Filepath: {filepath}")
        conn.close()

        # Delete the course folder in the bucket
        bucket = storage_client.bucket(bucket_name)
        blobs = list(bucket.list_blobs(prefix=filepath))  # Convert iterator to list to inspect it

        if blobs:
            print(f"Found {len(blobs)} blobs in '{filepath}'. Deleting...")
            for blob in blobs:
                blob.delete()
            print("Deletion complete.")
        else:
            print(f"No folder or files found at '{filepath}'. Skipping deletion.")

        index_name = "ai-tutor-index"

        # Check if the index exists first
        existing_indexes = pc.list_indexes()

        if index_name in existing_indexes:
            index = pc.Index(index_name)

            # Extract namespace from filepath
            filepath_parts = filepath.split('/')
            if len(filepath_parts) > 1:
                namespace = filepath_parts[1]

                # Get all stats (includes existing namespaces)
                stats = index.describe_index_stats()
                existing_namespaces = stats.get('namespaces', {})

                # Delete the namespace if it exists
                if namespace in existing_namespaces:
                    print(f"Deleting Pinecone namespace: {namespace}")
                    index.delete(delete_all=True, namespace=namespace)
                else:
                    print(f"Namespace '{namespace}' does not exist in Pinecone. Skipping deletion.")
            else:
                print(f"Invalid filepath format: {filepath}. Cannot extract namespace.")
        else:
            print(f"Pinecone index '{index_name}' does not exist. Skipping namespace deletion.")
            return jsonify(success=True, message="Course deleted successfully")
    
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


@app.route('/download')
def download_file():
    print("Download file endpoint hit")
    # Get user info from headers
    # user_id, username, user_role, folder_prefix = get_user_info_from_headers()
    # if not user_id:
    #     return jsonify(success=False, message="Unauthorized"), 401
    file_name = request.args.get('file')
    chatId = request.args.get('chatId')
    courseId = request.args.get('courseId') 
    print(f"File name: {file_name}, Chat ID: {chatId}, Course ID: {courseId}")
    if not file_name or (not chatId and not courseId):
        return jsonify(success=False, message="Missing file or course"), 400
    if not courseId:
        # Get course id from chatId
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT courseId FROM user_courses WHERE userCoursesId = %s", (chatId,))
        result = cursor.fetchone()
        conn.close()
        if not result:
            return jsonify(success=False, message="Chat not found"), 404
        courseId = result['courseId']
        print(f"File name: {file_name}, Course ID: {courseId}")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT filepath FROM courses WHERE id = %s", (courseId,))
    result = cursor.fetchone()
    conn.close()
    if not courseId:
        return jsonify(success=False, message="Course not found"), 404

    filepath = result['filepath']

    print(f"Downloading file: {file_name} for course: {courseId} at file path: {filepath}")

    blob_path = f"{filepath}{file_name}"
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
    # Get user info from headers
    user_id, username, user_role, folder_prefix = get_user_info_from_headers()
    if not user_id or user_role != 1:
        return jsonify(success=False, message="Unauthorized"), 401
    
    try:
        data = request.get_json()
        course_name = data.get("course_name")
        if not course_name:
            return jsonify({"success": False, "message": "Course name is required"}), 400

        # Run the training script with username, course_name, and proctor_id
        subprocess.run(['python', 'read_docs.py', username, course_name, str(user_id)], check=True)

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
    # Get user info from headers
    user_id, username, user_role, folder_prefix = get_user_info_from_headers()
    if not user_id or user_role != 1:
        return jsonify(success=False, message="Unauthorized"), 401
    
    try:
        data = request.get_json()
        student_username = data.get('username')
        course_name = data.get('course_name')
        
        if not (student_username and course_name and user_id):
            return jsonify({'success': False, 'message': 'Missing required parameters.'}), 400

        # Fetch the student ID
        student_query = "SELECT id FROM users WHERE username = %s AND role = 0"
        course_query = """SELECT c.id 
                            FROM courses c 
                            JOIN user_courses uc ON c.id = uc.courseId 
                            JOIN users u ON u.id = uc.userId 
                            WHERE c.name = %s AND u.id = %s AND u.role = 1"""
        
        # Establish a database connection
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(student_query, (student_username,))
            student_row = cursor.fetchone()
            if not student_row:
                return jsonify({'success': False, 'message': 'Student not found.'}), 404
            student_id = student_row[0]

            cursor.execute(course_query, (course_name, user_id))
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
        finally:
            cursor.close()
            conn.close()
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# Student-specific API for asking questions
@app.route('/ask-question', methods=['POST'])
def ask_question():
    print("Ask question endpoint hit")
    logging.debug("Ask question endpoint hit")

    # Get user info from headers
    user_id, username, user_role, folder_prefix = get_user_info_from_headers()
    print(f"User ID: {user_id}, Username: {username}, User Role: {user_role}, Folder Prefix: {folder_prefix}")
    if not user_id:
        return jsonify(success=False, message="Unauthorized"), 401
    try:
        data = request.get_json()
        chatId = data.get('chatId')
        question = data.get('question')
        answer = None  # Initialize answer to None
        # If answer is provided, get it
        if data.get('answer'):
            answer = data.get('answer')

        print(f"Chat ID: {chatId}, Question: {question}, Answer: {answer}")

        if not (user_id and chatId and question):
            return jsonify({'success': False, 'message': 'Missing required parameters.'}), 400

        # Call the generate_gpt_response function
        (tutor_response, sourceNames, messageId) = generate_gpt_response(user_id, chatId, question, answer)
        # Convert sourceNames to a string
        sourceNames = ', '.join(sourceNames) if sourceNames else ""

        return jsonify({'success': True, 'response': tutor_response, 'sourceName': sourceNames, 'messageId': messageId}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/get-courses', methods=['GET'])
def get_courses():
    # Get user info from headers
    user_id, username, user_role, folder_prefix = get_user_info_from_headers()
    if not user_id or user_role != 1:
        return jsonify(success=False, message="Unauthorized"), 401

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""SELECT c.id, c.name 
                       FROM courses c 
                       JOIN user_courses uc ON c.id = uc.courseId 
                       JOIN users u ON uc.userId = u.id 
                       WHERE u.id = %s""", (user_id,))
        courses = cursor.fetchall()
        # Return a list of courses as JSON
        return jsonify(success=True, courses=[{"id": row[0], "name": row[1]} for row in courses])
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/get-messages', methods=['GET'])
def get_messages():
    # Get user info from headers
    user_id, username, user_role, folder_prefix = get_user_info_from_headers()
    if not user_id:
        return jsonify(success=False, message="Unauthorized"), 401

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""SELECT c.id, c.name 
                       FROM courses c 
                       JOIN user_courses uc ON c.id = uc.courseId 
                       JOIN users u ON uc.userId = u.id 
                       WHERE u.id = %s""", (user_id,))
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
    # Get user info from headers
    user_id, username, user_role, folder_prefix = get_user_info_from_headers()
    if not user_id:
        return jsonify(success=False, message="Unauthorized"), 401
    
    try:
        if not user_id:
            return jsonify({'success': False, 'message': 'Student not logged in.'}), 403

        query = """
        SELECT c.id, c.name 
        FROM courses c 
        INNER JOIN user_courses uc ON c.id = uc.courseId 
        INNER JOIN users u ON uc.userId = u.id 
        WHERE u.id = %s AND u.role = 0
        """

        # Establish a database connection
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            # Fetch the courses for the student
            cursor.execute(query, (user_id,))
            courses = [{'id': row[0], 'name': row[1]} for row in cursor.fetchall()]
            return jsonify({'success': True, 'courses': courses}), 200
        finally:
            cursor.close()
            conn.close()

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/add-course', methods=['POST'])
def add_course():
    # Get user info from headers
    user_id, username, user_role, folder_prefix = get_user_info_from_headers()
    if not user_id or user_role != 1:
        return jsonify(success=False, message="Unauthorized"), 401
    
    folder_prefix = f"{username}_{user_id}/"

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
            "INSERT INTO courses (name, filepath) VALUES (%s, %s)",
            (course_name, f"{folder_prefix}{course_name}/")
        )
        course_id = cursor.lastrowid  # Get the ID of the newly created course

        # Associate the professor with the course
        cursor.execute(
            "INSERT INTO user_courses (userId, courseId) VALUES (%s, %s)",
            (user_id, course_id)
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

@app.route('/generate-report', methods=['POST'])
def generate_report():
    print("Generate report endpoint hit")
    # Get user info from headers
    user_id, username, user_role, folder_prefix = get_user_info_from_headers()
    if not user_id or user_role != 1:
        return jsonify(success=False, message="Unauthorized"), 401
    
    # Filters have F in front to differentiate from local variables
    FcourseId = request.args.get('class_id')
    FuserId = request.args.get('user_id')
    Fstart_date = request.args.get('start_date')
    Fend_date = request.args.get('end_date')
    Fqa_filter = request.args.get('qa_filter')

    print(f"Class ID: {FcourseId}, User ID: {FuserId}, Start: {Fstart_date}, End: {Fend_date}, QA Filter: {Fqa_filter}")
    if not FcourseId or not FuserId or not Fqa_filter:
        return jsonify(success=False, message="Missing course, user ID, or qa filter"), 400
    
    # Format filters + constructing parameters for the query - MUST BE DONE IN THIS ORDER
    params = [user_id]

    # Format qa filter
    if Fqa_filter == 'Both':
        qa_filter = 'question, answer'
    elif Fqa_filter == 'Questions':
        qa_filter = 'question'
    elif Fqa_filter == 'Answers':
        qa_filter = 'answer'

    # User filter
    if FuserId == 'All':
        user_filter = ""
    else:
        user_filter = "AND userId = %s"
        params.append(FuserId)

    # Course filter
    if FcourseId == 'All':
        course_filter = ""
    else:
        course_filter = "AND courseId = %s"
        params.append(FcourseId)

    # Format start and end dates
    if (Fstart_date and not Fend_date):
        # Default end date to today if only start date is provided
        Fend_date = datetime.today().strftime('%Y-%m-%d')

    if Fstart_date == 'null':
        Fstart_date = None
    if Fend_date == 'null':
        Fend_date = None

    # Include the entire end date
    if Fend_date:
        Fend_date += " 23:59:59"

    if (Fend_date and Fstart_date):
        ts_filter = "AND timestamp BETWEEN %s AND %s"
        params.append(Fstart_date)
        params.append(Fend_date)
    elif (Fstart_date and not Fend_date):
        ts_filter = "AND timestamp >= %s"
        params.append(Fstart_date)
    elif (Fend_date and not Fstart_date):
        ts_filter = "AND timestamp <= %s"
        params.append(Fend_date)
    else:
        ts_filter = ""

    # Construct the SQL query
    query = f"""
        SELECT {qa_filter}
        FROM messages
        WHERE userCoursesId IN (
            SELECT userCoursesId
            FROM user_courses
            WHERE courseId IN (
                SELECT courseId
                FROM user_courses
                WHERE userId = %s
            )
            {user_filter}
            {course_filter}

        )
        {ts_filter}
    """

    print(f"Executing query: {query}")
    print(f"With parameters: {params}")



    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(query, params)
        results = cursor.fetchall()
        # print(f"Query results: {results}") # Debugging line to check results
        if not results:
            return jsonify(success=False, message="No data found for the given filters"), 404
        
        # Format the results
        combined_text = ""
        for row in results:
            if 'question' in row:
                cleaned_question = clean_text(row['question'])
                combined_text += cleaned_question + " "
            if 'answer' in row:
                cleaned_answer = remove_answer_stop_words(row['answer'])
                cleaned_answer = clean_text(cleaned_answer)
                combined_text += cleaned_answer + " "
        combined_text = lemmatize_text(combined_text)  # Lemmatize the combined text
        combined_text = combined_text.strip()  # Remove any leading/trailing whitespace
        # print(f"Formatted results: {combined_text}")  # Debugging line to check formatted results

        # Generate word cloud
        wordcloud_image = generate_wordcloud(combined_text)
        return jsonify(success=True, image=f"data:image/png;base64,{wordcloud_image}")



    except Exception as e:
        print(f"Unexpected error: {e}")
        return jsonify(success=False, message=f"Unexpected error: {str(e)}"), 500
    finally:
        cursor.close()
        conn.close()

def remove_answer_stop_words(answer):
    """
    Remove formatting html tags from the answer.
    """
    soup = BeautifulSoup(answer, 'html.parser')
    answer = soup.get_text()

    # Remove any extra whitespace
    answer = re.sub(r'\s+', ' ', answer).strip()

    return answer

def clean_text(text):
    """
    Clean the text by removing non-alphanumeric characters, extra whitespace, and stop words.
    """

    # 1. Remove non-alphanumeric characters (keep spaces)
    text = re.sub(r'[^a-zA-Z0-9\s]', '', text)

    # 2. Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()

    # 3. Remove nltk stop words
    words = text.split()
    filtered_words = [word for word in words if word.lower() not in stop_words]
    cleaned_text = ' '.join(filtered_words)

    # 4. Remove custom stop words
    cleaned_text = ' '.join(word for word in cleaned_text.split() if word.lower() not in custom_stop_words)
    
    return cleaned_text

def lemmatize_text(text):
    """
    Lemmatize the text using NLTK's WordNetLemmatizer.
    """
    lemmatizer = WordNetLemmatizer()
    words = text.split()
    lemmatized_words = [lemmatizer.lemmatize(word) for word in words]
    return ' '.join(lemmatized_words)

def generate_wordcloud(text):
    """
    Generate a word cloud from the given text.
    """
    wordcloud = WordCloud(width=800, height=400, background_color='white').generate(text)

    # Save image to memory buffer
    img_io = BytesIO()
    plt.figure(figsize=(10, 5))
    plt.imshow(wordcloud, interpolation='bilinear')
    plt.axis('off')
    plt.tight_layout()
    plt.savefig(img_io, format='png', bbox_inches='tight', pad_inches=0)
    plt.close()
    img_io.seek(0)

    # Convert to base64 for easy frontend embedding
    base64_img = base64.b64encode(img_io.read()).decode('utf-8')
    return base64_img

if __name__ == '__main__':
    app.run(debug=True)