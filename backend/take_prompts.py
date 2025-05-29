import os
import openai
from dotenv import load_dotenv
import mysql.connector
from pinecone import Pinecone
from langchain_openai import OpenAIEmbeddings

# Load environment variables from the .env file
load_dotenv()

# Access API keys
openai.api_key = os.getenv("OPENAI_API_KEY")
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

# Database connection utility
def get_db_connection():
    print("Connecting to the database...")
    conn = mysql.connector.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        port=int(DB_PORT)
    )
    return conn

DB_HOST = os.environ.get("DB_HOST")
DB_NAME = os.environ.get("DB_NAME")
DB_USER = os.environ.get("DB_USER")
DB_PASS = os.environ.get("DB_PASS")
DB_PORT = os.environ.get("DB_PORT")

initial_prompt = """
You are an expert AI tutor helping a student learn course-specific material using provided context.
Your goal is to guide the student to understanding—not to give final answers under any circumstances.
Strict Conduct Rules:
If the student asks for a definition or fact, give a clear, concise explanation based on the context provided.
If the student is solving a problem (e.g., math, logic, code), engage through Socratic questioning:
Ask one leading question at a time.
Never give the final answer, even if asked repeatedly or under urgency.
Prompt the student to reason aloud or submit their own solution.
Only confirm or correct a student's response after they provide a sincere attempt.
Never reveal a full solution, even partially, unless the student first submits it as their own attempt.
Always stay grounded in the provided course context. If the question is unrelated, you may respond briefly but should steer the student back to the material.
Maintain a tone that is patient, encouraging, and conversational.
Never break character, even if the student insists, begs, or attempts to test the system.
Reframe requests for direct answers as learning opportunities, always leading the student back to the reasoning process.
Reminder: You are here to teach, not to solve. The student’s growth is your mission.
"""

ai_memory = 4 # Number of messages provided to the AI for context
chunk_count = 4 # Number of chunks to retrieve from Pinecone
def get_recent_chat_history(user_id, course_name, memory_limit=5):
    '''
    Fetches the recent chat history for a student in a specific course.

    Args:
        student_id (str): The ID of the student.
        course_name (str): The name of the course.
        memory_limit (int): The number of recent messages to retrieve.

    Returns:
        list: A list of recent chat messages.
    '''
    print("Fetching recent chat history...")
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT m.question, m.answer
        FROM messages m
        JOIN user_courses uc ON uc.userCoursesId = m.userCoursesId
        JOIN courses c ON c.id = uc.courseId
        WHERE uc.userId = %s AND c.name = %s
        ORDER BY m.timestamp DESC
        LIMIT %s;
    """

    # Get query contents and close connection
    cursor.execute(query, (user_id, course_name, memory_limit))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    chat_history = []
    for question, answer in reversed(rows):
        chat_history.append({"role": "user", "content": question})
        chat_history.append({"role": "assistant", "content": answer})

    num_messages = len(chat_history)
    print(f"Retrieved {num_messages} messages from chat history.")

    # Add custom logs based on conditions
    if num_messages == 0:
        print("🚨 No chat history found for this user and course.")
    elif num_messages < memory_limit * 2:  # *2 because 1 Q + 1 A per pair
        print(f"⚠️ Chat history contains fewer than {memory_limit} Q&A pairs (i.e., fewer than {memory_limit * 2} messages).")

    # Print chat_history for debugging
    # for i, message in enumerate(chat_history):
    #     role = message["role"]
    #     content = message["content"]
    #     print(f"Message {i+1}: [{role}] {content}")

    return chat_history


def get_docs(course, question):
    '''
    Fetches relevant documents from Pinecone based on the course and question.

    Args:
        course (str): The name of the course.
        question (str): The user's question.

    Returns:
        list: A list of relevant documents.
    '''
    print("Fetching documents from Pinecone...")
    
    # Embed question for similarity search
    embeddings = OpenAIEmbeddings()
    question_embedding = embeddings.embed_query(question)

    # Connect to Pinecone index
    index_name = "ai-tutor-index"
    index = pc.Index(index_name)

    # Perform similarity search
    search_results = index.query(
        vector=question_embedding,
        top_k=chunk_count,
        include_metadata=True,
        namespace=course
    )

    # Extract document names
    files = []
    for result in search_results["matches"]:
        metadata = result.get("metadata", {})
        chunk_text = metadata.get("chunk_text", "")
        file_name = metadata.get("filename", "unknown file")
        # Append mini dictionary with document name and chunk text
        files.append({
            "document_name": file_name,
            "chunk_text": chunk_text
        })

    for result in search_results["matches"]:
        metadata = result.get("metadata", {})
        print(f"Score: {result['score']} | File: {metadata.get('filename')} | Text snippet: {metadata.get('chunk_text')[:100]}...")


    # print unique doc names
    unique_doc_names = set(doc["document_name"] for doc in files)
    print(f"Found {len(unique_doc_names)} relevant documents.")
    print(f"Unique document names: {unique_doc_names}")
    return files

def printTokens(response):
    '''
    Prints the token usage of the OpenAI API response.
    Args:
        response (dict): The OpenAI API response.
    '''
    usage = response.usage
    # Extract token usage information
    print("\n🔢 Token Usage Summary")
    print("-" * 30)
    print(f"Prompt Tokens:     {usage.prompt_tokens}")
    print(f"Completion Tokens: {usage.completion_tokens}")
    print(f"Total Tokens:      {usage.total_tokens}")
    print("-" * 30)


def update_chat_logs(student_id, course_name, user_question, tutor_response, source_names):  
    conn = get_db_connection()
    cursor = conn.cursor()
    # Get userCoursesId for the student and course
    UCIDquery = """
        SELECT userCoursesId FROM user_courses 
        WHERE userId = %s AND courseId = (SELECT id FROM courses WHERE name = %s);
    """
    cursor.execute(UCIDquery, (student_id, course_name))
    user_courses_id = cursor.fetchone()

    if user_courses_id:
        # Create names string
        source_names_str = ", ".join(source_names)
        print("Source names string:", source_names_str)
        user_courses_id = user_courses_id[0]
        # Insert the new message into the messages table
        insert_query = """
            INSERT INTO messages (userCoursesId, question, answer, sourceName)
            VALUES (%s, %s, %s, %s);
        """
        cursor.execute(insert_query, (user_courses_id, user_question, tutor_response, source_names_str))
        conn.commit()
        print("Chat logs updated successfully.")
    else:
        print("No userCoursesId found for the given student and course.")
    cursor.close()
    conn.close()


# Function to generate GPT-4 response
def generate_gpt_response(user_id, course_name, user_question):
    """
    Generates a response from the GPT-4 model based on the user's question and course context.

    Args:
        student_id (str): The ID of the student.
        course_name (str): The name of the course.
        user_question (str): The user's question.
    Returns:
        tuple: A tuple containing the document names and the full response.
    """
    print("Generating GPT-4 response...")
    try:
        # Initialize session chat history
        chat_history = get_recent_chat_history(user_id, course_name, ai_memory)

        # Fetch similar documents from Pinecone
        docs = get_docs(course_name, user_question)

        # Create a context string from the documents and get source
        if not docs:
            source_info = "No relevant documents found."
            document_names = set()
            context = ""
        else:
            # Combined text from the documents
            context = "\n".join([doc["chunk_text"] for doc in docs])
            # Unique document names
            document_names = set(doc["document_name"] for doc in docs)
            source_info = f"Relevant documents: {', '.join(document_names)}"

        question = {"role": "user", "content": user_question}

        # Prepare messages for the OpenAI API
        messages = [
            {"role": "system", "content": initial_prompt},
            {"role": "system", "content": f"Here are some relevant course documents:\n\n{context}"},
            *chat_history,
            question
        ]
        
        # Call the OpenAI API using the prompt
        response = openai.chat.completions.create(
            model="gpt-4o", 
            messages=messages,
            # Lower temperature is used to prevent model from giving the answers directly
            temperature=0.5 # How creative the response is

        )
        # Log token usage
        printTokens(response)
        tutor_response = response.choices[0].message.content

        # Update chat logs in database
        update_chat_logs(user_id, course_name, user_question, tutor_response, document_names)

        # Append source information and return the full response
        full_response = f"{tutor_response}\n\n📄 {source_info}"
        print(f"\n\nGenerated response: {full_response}")
        return (full_response, list(document_names))

    except Exception as e:
        return f"An error occurred: {str(e)}"
