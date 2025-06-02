# Cloud Mentor
# AI Tutor Platform

A cloud-based, AI-driven tutoring platform that leverages Google Cloud, Pinecone, and GPT-4 to help students learn course content efficiently.

## Table of Contents
- [Project Overview](#project-overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Database Structure](#database-structure)
- [API Endpoints](#api-endpoints)
- [Current Development](#current-development)
- [Future Development](#future-development)
- [License](#license)

## Project Overview
The AI Tutor Platform provides a customized learning experience using AI. It allows proctors to upload course documents, processes them to understand content, and enables students to ask questions on the material.

## Features
- Cloud-based AI tutoring with OpenAI GPT-4
- Google Cloud Integration for file storage and database management
- Pinecone Integration for vector comparisons and quick course context
- Secure access and role-based management with MySQL

## Installation
1. Install <a href="https://www.apachefriends.org/download.html">XAMPP</a>
2. Clone the repository in XAMPP's htdocs folder:
    ```bash
    cd C:\xampp\htdocs
    git clone https://github.com/yourusername/yourrepository.git
    cd yourrepository
    ```
3. Install the dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4. Add gcloud_keys folder to backend
5. Set up environment variables in a `.env` file for Python backend:
    ```plaintext
    OPENAI_API_KEY=your_openai_api_key
    PINECONE_API_KEY=your_pinecone_api_key
    GOOGLE_APPLICATION_CREDENTIALS="path/to/your/credentials.json"
    DB_HOST=your_host
    DB_NAME=your_db
    DB_USER=your_user
    DB_PASS=your_password
    DB_PORT=your_port
    ```
6. Add db_config.php to /backend/includes/ and add environment variables for PHP frontend:
   ```php
    <?php
    $host = your_host;
    $dbUsername = your_username;
    $dbPassword = your_password;
    $database = your_database;
    $port = your_port;
    ?>
    ```
7. Add db_connect.php to /backend/includes/ and add database connection instructions:
    ```php
    <?php
    require_once "db_config.php"; 
    
    //Create database connection
    $connection = new mysqli($host, $dbUsername, $dbPassword, $database, $port);
    
    //Check if the connection was successful
    if ($connection->connect_error) {
        die("Connection failed: ".$connection->connect_error);
    }
    ?>
    ```
8. Turn on XAMPP's MySQL and initialize database:
    ```bash
    cd backend/database/
    python initializeTables.py
    ```
9. (Bonus Step - Recommended) Create a proctor account:<br>
    Sign up with proctor username and password on the site and then run the following:
    ```bash
    cd backend/database/
    python createProctor.py <your_username_here>
    ```

## Usage
1. Run the Flask Application:
```bash
  cd backend
  python app.py
 ```
2. Start Apache and MySQL on XAMPP Control Panel<br>
3. Navigate [here](http://localhost/JayWingAITutor/frontend/), accessible in your browser.

## Database Structure
The platform includes the following database tables:

- TODO: UPDATE
- Proctors - Stores proctor ID, email, and password.
- Courses - Stores course information, including name, proctor association, and file paths.
- Students - Stores student information, including usernames and passwords.
- Student_Courses - Links students to their courses and tracks individual learning contexts.

## API Endpoints
- TODO: UPDATE
- /upload - Upload course materials.
- /train - Process course documents to build an AI model.
- /chat - Interact with the AI tutor.

## Current Development
- TODO: UPDATE
- Full integration of the PostgreSQL database into the program
- Exploration of Mathematical support
- Test of more variety of models

## Future Development
- TODO: UPDATE
- Add support for new file types
- Expand AI model capabilities with interactive and adaptive learning modules
- Integrate multi-language support
- Build into Etown platforms such as JayWing

## License
This project is licensed under the MIT License.
