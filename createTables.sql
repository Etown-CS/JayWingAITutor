-- DROP TABLES IN ORDER TO AVOID FK CONSTRAINT ERRORS
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS chats;
DROP TABLE IF EXISTS user_courses;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS courses;

-- USERS TABLE
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    role SMALLINT CHECK (role IN (0, 1)) -- 0 = student, 1 = professor
);

-- COURSES TABLE
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    courseCode VARCHAR(6) UNIQUE,
    description TEXT,
    filepath VARCHAR(100) UNIQUE
);

-- USER_COURSES TABLE (join table)
CREATE TABLE user_courses (
    userCoursesId SERIAL PRIMARY KEY,
    userId INT NOT NULL,
    courseId INT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
);

-- CHATS TABLE
CREATE TABLE chats (
    chatId SERIAL PRIMARY KEY,
    userCoursesId INT NOT NULL,
    creationTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userCoursesId) REFERENCES user_courses(userCoursesId) ON DELETE CASCADE
);

-- MESSAGES TABLE
CREATE TABLE messages (
    messageId SERIAL PRIMARY KEY,
    chatId INT NOT NULL,
    question TEXT,
    answer TEXT,
    sourceName VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chatId) REFERENCES chats(chatId) ON DELETE CASCADE
);

-- GRANT ACCESS TO APP USER
-- GRANT SELECT, INSERT, UPDATE, DELETE ON users, courses, user_courses, chats, messages TO {INSERT_USER};
-- GRANT USAGE, SELECT ON SEQUENCE users_id_seq, courses_id_seq, user_courses_userCoursesId_seq, chats_chatId_seq, messages_messageId_seq TO {INSERT_USER};
