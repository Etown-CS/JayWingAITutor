-- Drop existing tables if they exist (optional, for fresh setup)
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS user_courses;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS courses;

-- Create 'users' table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    role TINYINT(1) NOT NULL
);

-- Create 'courses' table
CREATE TABLE courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL, -- Each professor can only have one course with the same name but the same course can be taught by multiple professors
    createdBy INT NOT NULL,
    filepath VARCHAR(100),
    courseCode VARCHAR(20) UNIQUE, -- Size increased to handle "EGR/CS222" -- 20 characters should be more than enough
    description TEXT
);

-- Create 'user_courses' table (join table)
CREATE TABLE user_courses (
    userCoursesId INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    courseId INT NOT NULL,
    interest VARCHAR(100) DEFAULT NULL,
    responseLength VARCHAR(20) DEFAULT 'Average',
    archived TINYINT(1) NOT NULL DEFAULT 0,
    -- enforce one enrollment per user per course:
    UNIQUE KEY unique_course_user (courseId, userId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
);

-- Create 'messages' table
CREATE TABLE messages (
    messageId INT AUTO_INCREMENT PRIMARY KEY,
    userCoursesId INT NOT NULL,
    question TEXT,
    answer TEXT,
    timestamp DATETIME DEFAULT current_timestamp,
    sourceName VARCHAR(100),
    feedbackRating ENUM('up', 'down') DEFAULT NULL,
    feedbackExplanation TEXT,
    feedbackTimestamp DATETIME DEFAULT NULL,
    FOREIGN KEY (userCoursesId) REFERENCES user_courses(userCoursesId) ON DELETE CASCADE
);
