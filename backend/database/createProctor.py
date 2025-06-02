import sys
from dotenv import load_dotenv
import os
import mysql.connector

load_dotenv()

# Define database connection parameters
DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
DB_PORT = os.getenv("DB_PORT")

def get_db_connection():
    conn = mysql.connector.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        port=int(DB_PORT)
    )
    return conn


def createProctor():
    if len(sys.argv) < 2:
        print("Usage: python app.py <username>")
        sys.exit(1)

    username = sys.argv[1]
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if the username exists
    cursor.execute("SELECT COUNT(*) FROM users WHERE username = %s", (username,))
    exists = cursor.fetchone()[0]
    if not exists:
        print(f"Username '{username}' does not exist. Please choose a different username.")
        cursor.close()
        conn.close()
        sys.exit(1)
    
    # Check if the user is already a proctor
    cursor.execute("SELECT COUNT(*) FROM users WHERE username = %s AND role = 1", (username,))
    is_proctor = cursor.fetchone()[0]
    if is_proctor:
        print(f"User '{username}' is already a proctor.")
        cursor.close()
        conn.close()
        sys.exit(1)

    # Update the user's role to proctor
    cursor.execute("UPDATE users SET role = 1 WHERE username = %s", (username,))
    conn.commit()
    cursor.close()
    conn.close()
    # Print success message
    print(f"User '{username}' has been successfully updated to proctor role.")
    sys.exit(0)


if __name__ == "__main__":
    createProctor()