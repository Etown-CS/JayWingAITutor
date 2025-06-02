# TODO: FIX THIS FILE - DO NOT USE CURRENTLY
import os
from dotenv import load_dotenv
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

def initialize_tables():
    # Read the SQL file
    with open("createTables.sql", "r") as f:
        create_tables_sql = f.read()

    # Connect to the PostgreSQL server
    conn = get_db_connection()

    conn.autocommit = True
    cursor = conn.cursor()

    # Execute the SQL script to create tables if they don't exist
    cursor.execute(create_tables_sql)
    print("Tables initialized if they did not already exist.")
    cursor.close()
    conn.close()
    

# Call initialize_tables when the application starts
if __name__ == "__main__":
    initialize_tables()
