"""
    app.py - Backend Flask REST API for AI Tutor application

    Sections:
    1. Imports
    2. Global Overhead
        a. Database Connection / Setup
        b. Global Variables
        c. Header Function
    3. Document Handling Endpoints
        a. /upload
        b. /load-docs
        c. /download
        d. /delete
        e. /delete-course
    4. Student-Specific Endpoints
        a. /ask-question
    5. Report Generation Functions + Endpoint
        a. /generate-report
        b. Helper Functions
            i. remove_answer_stop_words
            ii. clean_text
            iii. get_wordnet_pos
            iv. lemmatize_text
            v. generate_wordcloud
            vi. etown_color_func
    6. Main Application Run
"""

# --------------------------------------------------- #
# --------------------- Imports --------------------- #
# --------------------------------------------------- #

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
from nltk import pos_tag
from nltk.corpus import wordnet
from nltk.stem import WordNetLemmatizer
from wordcloud import WordCloud
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from io import BytesIO
import base64
import random

# ----------------------------------------------------------- #
# --------------------- Global Overhead --------------------- #
# ----------------------------------------------------------- #

stop_words = set(stopwords.words('english'))
custom_stop_words = {'like', 'lets', 'one', 'something', 'start', 'begin', 'try', 'trying', 'go', 'back', 'step', 'thing', 'another', 'keep', 'much', 'done', 'dont', 'doesnt', 'didnt', 'isnt', 'possible', 'different', 'suppose', 'used', 'might', 'think', 'youre', 'often', 'make', 'need', 'use', 'consider', 'ensure', 'involes', 'include', 'understand'}

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
    """
    Check if a file has an allowed extension: pdf or pptx.

    Args:
        filename (str): The name of the file to check.
    Returns:
        bool: True if the file has an allowed extension, False otherwise.
    """
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_user_info_from_headers():
    """
    Extract user information from request headers.
    Returns:
        tuple: (user_id, username, user_role, folder_prefix) if headers are valid,
               (None, None, None, None) otherwise.
    """
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

# ----------------------------------------------------------------------- #
# --------------------- Document Handling Endpoints --------------------- #
# ----------------------------------------------------------------------- #

@app.route('/upload', methods=['POST'])
def upload_file():
    """
    Uploads a file to the Google Cloud Storage bucket and processes it with Pinecone.

    Requires: headers, courseId, and file(s)

    Return: success message or error message.
    """
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
    """
    Loads documents for a specified course from Google Cloud Storage.

    Requires: headers and courseId

    Return: a list of files with their names and types.
    """
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

@app.route('/download')
def download_file():
    """
    Downloads a file from Google Cloud Storage for a specified course.

    Requires: file name, courseId, and chatId

    Return: the file as an attachment or an error message.
    """
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

# Delete file endpoint
@app.route('/delete', methods=['DELETE'])
def delete_file():
    """
    Deletes a file from Google Cloud Storage and Pinecone for a specified course.

    Requires: headers, file name and courseId

    Return: success message or error message.
    """
    print("Delete file endpoint hit")
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
    try:
        blob = bucket.blob(filepath)
        if blob.exists():
            blob.delete()
            gcs_deleted = True
        else:
            return jsonify(success=False, message="File not found in GCS"), 404
    except Exception as e:
        return jsonify(success=False, message=f"Error deleting from GCS: {str(e)}")

    # Attempt to delete from Pinecone
    try:
        index_name = "ai-tutor-index"
        index = pc.Index(index_name)
        
        # Check if the index exists first
        existing_indexes = list(pc.list_indexes())

        print(f"Existing Pinecone indexes: {existing_indexes}")
        print(f"Checking for index: {index_name}")
        print(type(existing_indexes))

        exists = any(index["name"] == index_name for index in existing_indexes)
        print(f"Index exists: {exists}")

        if exists:
            index = pc.Index(index_name)
        else:
            return jsonify(success=False, message="Pinecone index does not exist"), 404
        
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
    """
    Deletes files for a specified course

    Requires: headers and courseId

    Return: success message or error message.
    """
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
        
        exists = any(index["name"] == index_name for index in existing_indexes)

        if exists:
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
                return jsonify(success=True, message="Course deleted successfully")
            else:
                print(f"Invalid filepath format: {filepath}. Cannot extract namespace.")
                return jsonify(success=False, message="Invalid filepath format. Cannot extract namespace."), 400
        else:
            print(f"Pinecone index '{index_name}' does not exist. Skipping namespace deletion.")
            return jsonify(success=True, message="Course deleted successfully")
    
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500

# ----------------------------------------------------------------------- #
# --------------------- Student-Specific Endpoints ---------------------- #
# ----------------------------------------------------------------------- #

# Student-specific API for asking questions
@app.route('/ask-question', methods=['POST'])
def ask_question():
    """
    Endpoint for students to ask questions.

    Requires: headers, chatId, question, and optionally answer

    Return: success message with tutor response, source names, and message ID or error message.
    """
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

# ---------------------------------------------------------------------------------- #
# --------------------- Report Generation Functions + Endpoint --------------------- #
# ---------------------------------------------------------------------------------- #

@app.route('/generate-report', methods=['POST'])
def generate_report():
    """
    Endpoint for generating reports.

    Requires: headers, class_id, user_id, start_date, end_date, qa_filter, and stop_words

    Return: success message with word cloud image or error message.
    """
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
    Fstop_words = request.args.get('stop_words')

    # Check required parameters - these should never be None because their defaults are set in the frontend
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
                cleaned_question = lemmatize_text(row['question'])
                cleaned_question = clean_text(cleaned_question, Fstop_words)
                combined_text += cleaned_question + " "
            if 'answer' in row:
                cleaned_answer = remove_answer_stop_words(row['answer'])
                cleaned_answer = lemmatize_text(cleaned_answer)
                cleaned_answer = clean_text(cleaned_answer, Fstop_words)
                combined_text += cleaned_answer + " "
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

# Word cloud helper functions
def remove_answer_stop_words(answer):
    """
    Remove formatting html tags from the answer.

    Args:
        answer (str): The answer text to clean.
    Returns:
        str: Cleaned answer text without HTML tags and extra whitespace.
    """
    soup = BeautifulSoup(answer, 'html.parser')
    answer = soup.get_text()

    # Remove any extra whitespace
    answer = re.sub(r'\s+', ' ', answer).strip()

    return answer

def clean_text(text, added_stop_words=''):
    """
    Clean the text by removing non-alphanumeric characters, extra whitespace, and stop words.

    Args:
        text (str): The text to clean.
        added_stop_words (str): Comma-separated string of additional stop words to remove.
    Returns:
        str: Cleaned text with stop words removed.
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
    all_custom_stop_words = custom_stop_words.union(set([word.strip() for word in added_stop_words.split(",")]))
    cleaned_text = ' '.join(word for word in cleaned_text.split() if word.lower() not in all_custom_stop_words)
    
    return cleaned_text

def get_wordnet_pos(treebank_tag):
    """
    Convert NLTK POS tags to WordNet POS tags.

    Args:
        treebank_tag (str): The POS tag from NLTK's pos_tag function.
    Returns:
        str: The corresponding WordNet POS tag.
    """
    if treebank_tag.startswith('J'):
        return wordnet.ADJ
    elif treebank_tag.startswith('V'):
        return wordnet.VERB
    elif treebank_tag.startswith('N'):
        return wordnet.NOUN
    elif treebank_tag.startswith('R'):
        return wordnet.ADV
    else:
        return wordnet.NOUN  # fallback to noun

def lemmatize_text(text):
    """
    Lemmatize text using NLTK's WordNetLemmatizer with proper POS tagging.

    Args:
        text (str): The text to lemmatize.
    Returns:
        str: Lemmatized text.
    """
    lemmatizer = WordNetLemmatizer()
    words = text.split()
    pos_tags = pos_tag(words)

    # print(f"POS tags: {pos_tags}")  # Debugging line to check POS tags
    lemmatized_words = [
        lemmatizer.lemmatize(word, get_wordnet_pos(tag))
        for word, tag in pos_tags
    ]
    return ' '.join(lemmatized_words)

def generate_wordcloud(text):
    """
    Generate a word cloud from the given text.

    Args:
        text (str): The text to generate the word cloud from.
    Returns:
        str: Base64 encoded image of the word cloud.
    """
    # Uncertain on whether to include collocations or not, but set to False for now
    wordcloud = WordCloud(width=800, height=510, background_color='white', color_func=etown_color_func, collocations=False).generate(text)

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

def etown_color_func(word, font_size, position, orientation, random_state=None, **kwargs):
    """
    Return a color based on Elizabethtown College's branding.

    Args:
        word (str): The word to color.
        font_size (int): The size of the font.
        position (tuple): The position of the word.
        orientation (str): The orientation of the word.
        random_state (RandomState): Random state for reproducibility.
        **kwargs: Additional keyword arguments.
    Returns:
        str: Hex color code for the word.
    """
    colors = [
        "#00529B",  # Royal Blue
        "#5FADF1",  # Light Blue
        "#A7A8AA",  # Gray
        "#003865"   # Darker Blue Accent
    ]
    return random.choice(colors)

# ------------------------------------------------------------ #
# --------------------- Main Application --------------------- #
# ------------------------------------------------------------ #

if __name__ == '__main__':
    app.run(debug=True)