DROP TABLE user_courses;
DROP TABLE users;
DROP TABLE courses;
DROP TABLE course_chunks;

-- USERS TABLE
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    role SMALLINT NOT NULL CHECK (role IN (0, 1)) -- 0 = student, 1 = professor (assumed)
);

-- COURSES TABLE
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(45) NOT NULL,
    context TEXT,
    filepath VARCHAR(45)
);

-- USER_COURSES TABLE (join table)
CREATE TABLE user_courses (
    userId INT NOT NULL,
    courseId INT NOT NULL,
    learnedContext TEXT,
    PRIMARY KEY (userId, courseId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
);

-- COURSE_CHUNKS TABLE --> Upgrade to use proper embedding in the future
CREATE TABLE course_chunks (
    id SERIAL PRIMARY KEY,
    courseId INT NOT NULL,
    chunkText TEXT,
    embedding FLOAT,
    FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
);
