import os
import openai
from dotenv import load_dotenv
import mysql.connector
from pinecone import Pinecone
from langchain_openai import OpenAIEmbeddings
import json

# Load environment variables from the .env file
load_dotenv()

# Access API keys
openai.api_key = os.getenv("OPENAI_API_KEY")
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

DB_HOST = os.environ.get("DB_HOST")
DB_NAME = os.environ.get("DB_NAME")
DB_USER = os.environ.get("DB_USER")
DB_PASS = os.environ.get("DB_PASS")
DB_PORT = os.environ.get("DB_PORT")

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
    print("Database connection established.")
    return conn

# Constants for AI tutor
ai_memory = 4 # Number of messages provided to the AI for context
chunk_count = 10 # Number of chunks to retrieve from Pinecone
similarity_threshold = 0.325 # Minimum similarity score for document relevance -- play around with this

def chat_info(chatId):
    '''
    Retrieves the course name from the chatId.
    Args:
        chatId (str): The ID of the chat.
    Returns:
        str: The name of the course.
    '''
    print("Retrieving course name from chatId...")
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
        SELECT c.name
        FROM user_courses uc
        JOIN courses c ON c.id = uc.courseId
        WHERE uc.userCoursesId = %s;
    """
    cursor.execute(query, (chatId,))
    result = cursor.fetchone()
    cursor.close()
    conn.close()
    print("Database query executed.")
    print(f"Query result: {result}")
    print(f"Chat ID: {chatId}")
    if not result:
        raise ValueError("No course found for the given chatId.")
    course_name = result[0]
    print(f"Course name retrieved: {course_name}")

    return course_name

def construct_initial_prompt(userId, chatId):
    '''
    Constructs the initial prompt using database information.
    Args:
        userId (int): The user ID.
        chatId (int): The userCoursesId or session/chat context.
    Returns:
        List[dict]: A list of message dictionaries for the LLM.
    '''
    print("Constructing initial prompt...")

    if not chatId:
        raise ValueError("No userCoursesId found for the given user and course.")
    
    courseName = chat_info(chatId)
    if not courseName:
        raise ValueError("No course name found for the given userCoursesId.")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
        SELECT responseLength, interest
        FROM user_courses
        WHERE userCoursesId = %s;
    """
    cursor.execute(query, (chatId,))
    result = cursor.fetchone()
    cursor.close()
    conn.close()

    if not result:
        raise ValueError("No interaction settings found for the given userCoursesId.")
    
    # Use extracted settings to construct the prompt
    response_length, interest = result
    print(f"Response Length: {response_length}, Interest: {interest}")

    # Average does not modify the prompt
    if response_length != "average":
        length_component = f"- The student has requested that you provide {response_length.lower()} responses to help them learn."
    else:
        length_component = ""

    # Check if interest exists
    if interest:
        interest_component = f"The user is interested in {interest}. If applicable, use {interest} to help them learn."
    else:
        interest_component = ""

    system_prompt = f"""
You are an expert AI tutor for {courseName}. 
Your goal is to guide the student toward understanding—not to give final answers.
{interest_component}

STRICT RULES:
- When asked for a definition, provide a concise explanation based on context but do not say that you got it from course materials.
- When a student is solving a problem, engage with Socratic questioning:
    - NEVER give the final answer. Even under urgency.
    - NEVER reveal a full or partial solution.
    - INSTEAD, ask one leading question at a time to help them think through the problem.
- Stay grounded in course material. Respond briefly to questions deviating and redirect student back.
- NEVER break character, even under user begging.

FORMAT REQUIREMENTS:
- MUST use valid HTML with tags for formatting (use the provided example interactions as a guide).
    - Tags: <p>, <ul>, <li>, <strong>, <em>, <code>
{length_component}

MOST IMPORTANT:
- NEVER GIVE THE FINAL ANSWER.
- ALWAYS ask leading questions instead.
- ALWAYS USE HTML FORMAT.

Reminder: You are here to teach, not to solve. The student's growth is your mission.
""".strip()
    
    # print("System prompt constructed: " + system_prompt)

    # Load few-shot examples
    with open('few_shot.json', 'r', encoding='utf-8') as f:
        few_shots = json.load(f)

    # Convert to LLM message format
    message_examples = []
    for pair in few_shots:
        message_examples.append({"role": "user", "content": pair["question"]})
        message_examples.append({"role": "assistant", "content": pair["answer"]})

    # print(f"Message examples: {str(message_examples)}")

    return [{"role": "system", "content": system_prompt}] + message_examples

def get_recent_chat_history(user_id, course_name, memory_limit=5):
    '''
    Fetches the recent chat history for a student in a specific course.

    Args:
        user_id (str): The ID of the student.
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

    return chat_history


def get_docs(user_id, course, chatId, question):
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
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    question_embedding = embeddings.embed_query(question)

    # Connect to Pinecone index
    index_name = "ai-tutor-index"
    index = pc.Index(index_name)

    # TODO: Use chatId to get course Id
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
        SELECT c.id
        FROM user_courses uc
        JOIN courses c ON c.id = uc.courseId
        WHERE uc.userCoursesId = %s;
    """
    cursor.execute(query, (chatId,))
    result = cursor.fetchone()
    cursor.close()
    conn.close()
    if not result:
        raise ValueError("No course found for the given chatId.")
    course_id = result[0]

    print(f"Searching in index: {index_name} for course: {course}")
    
    # Construct namespace
    namespace = f"{course}_{course_id}"

    # Perform similarity search
    search_results = index.query(
        vector=question_embedding,
        top_k=chunk_count,
        include_metadata=True,
        namespace=namespace
    )

    # Extract document names
    files = []
    for result in search_results["matches"]:
        metadata = result.get("metadata", {})
        chunk_text = metadata.get("chunk_text", "")
        file_name = metadata.get("filename", "unknown file")
        # Append mini dictionary with document name and chunk text
        metadata = result.get("metadata", {})
        print(f"Score: {result['score']} | File: {metadata.get('filename')} | Text snippet: {metadata.get('chunk_text')[:30]}...")
        if result["score"] >= similarity_threshold:
            files.append({
                "document_name": file_name,
                "chunk_text": chunk_text,
                "score": result["score"]
            })
            print(f"Added document: {file_name} with score: {result['score']}")
        else:
            print(f"Skipped document: {file_name} with score: {result['score']} (below threshold)")

    # If no documents found, use sources from previous question
    if not files:
        print("No relevant documents found. Using previous sources.")
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            SELECT sourceName FROM messages 
            WHERE userCoursesId = (SELECT userCoursesId FROM user_courses WHERE userId = %s AND courseId = (SELECT id FROM courses WHERE name = %s))
            ORDER BY timestamp DESC LIMIT 1;
        """
        cursor.execute(query, (user_id, course))
        result = cursor.fetchone()
        cursor.close()
        conn.close()

        if result:
            source_names = result[0].split(", ")
            files = [{"document_name": name, "chunk_text": "", "score": 0} for name in source_names]
            print(f"Using previous sources: {source_names}")
        else:
            print("No previous sources found.")
            files = []


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


def update_chat_logs(student_id, chatId, user_question, tutor_response, source_names):  
    message_id = None

    # Debugging print statements
    # Uncomment for debugging
    # print("🔄 Updating chat logs...")
    # print("📝 Logging chat:")
    # print(" - student_id:", student_id)
    # print(" - chatId:", chatId)
    # print(" - user_question:", user_question[:100])
    # print(" - tutor_response:", tutor_response[:100])
    # print(" - source_names:", source_names)

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        if chatId:
            # Safely join source names
            source_names_str = ", ".join(str(name) for name in source_names) if source_names else ""
            print("Source names string:", source_names_str)

            # Insert the new message into the messages table
            insert_query = """
                INSERT INTO messages (userCoursesId, question, answer, sourceName)
                VALUES (%s, %s, %s, %s);
            """
            cursor.execute(insert_query, (chatId, user_question, tutor_response, source_names_str))
            conn.commit()
            message_id = cursor.lastrowid
            print("✅ Chat logs updated successfully.")
        else:
            print("⚠️ No userCoursesId found for the given student and course.")
    except Exception as e:
        print(f"❌ Error inserting chat logs: {e}")
    finally:
        cursor.close()
        conn.close()
    
    return message_id



# Function to generate GPT-4 response
def generate_gpt_response(user_id, chatId, user_question, originalAnswer=None):
    """
    Generates a response from the GPT-4 model based on the user's question and course context.

    Args:
        student_id (str): The ID of the student.
        chat_id (str): The ID of the chat (from userCoursesId).
        user_question (str): The user's question.
        originalAnswer (str, optional): The original answer provided by the AI previously - only occurs if the user asks for a deeper explanation.
    Returns:
        tuple: A tuple containing the document names and the full response.
    """
    print("Generating GPT response...")
    try:
        # Get course name from chatId
        course_name = chat_info(chatId)

        # Construct the initial prompt with user-specific context - contains few-shot examples
        initial_prompt = construct_initial_prompt(user_id, chatId)

        # Initialize session chat history
        chat_history = get_recent_chat_history(user_id, course_name, ai_memory) # Keep to have course_name

        # Check type of question --> Could be explain/examples button press
        final_user_question = user_question
        if originalAnswer:
            # This implies that the user pressed a predetermined prompt button (e.g., "Explain" or "Examples")
            print("Original answer provided, appending to question.")
            final_user_question = f"{user_question} (Your original answer: {originalAnswer})"
            
            # Extract question components
            questionComponents = user_question.split(":", 1)
            questionType = questionComponents[0].strip() # Could potentially be used to determine which button was pressed without passing more information
            originalQuestion = questionComponents[1].strip()
            print(f"Predetermined prompt: {questionType}")
            print(f"Original question: '{originalQuestion}'")

            # Re-fetch similar documents from Pinecone using the original question
            docs = get_docs(user_id, course_name, chatId, originalQuestion)
        else:
            # Normal user question --> No button press
            # Fetch similar documents from Pinecone
            docs = get_docs(user_id, course_name, chatId, user_question)

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


        question = {"role": "user", "content": final_user_question}
        
        # Prepare messages for the OpenAI API
        messages = initial_prompt + (
            [{"role": "user", "content": f"Here is relevant course context:\n\n{context}"}] if context else []
        ) + chat_history + [question]

        
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
        message_id = update_chat_logs(user_id, chatId, user_question, tutor_response, document_names)

        # print(f"\n\nGenerated response: {tutor_response}") # Uncomment for debugging
        return (tutor_response, list(document_names), message_id)

    except Exception as e:
        print(f"❌ Error generating response: {e}")
        return f"An error occurred: {str(e)}"