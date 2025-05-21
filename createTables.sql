DROP TABLE user_courses;
DROP TABLE users;
DROP TABLE courses;

-- MAKE SURE YOU GIVE ACCESS TO THESE TABLES TO THE USER IN .env FILE
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
    name VARCHAR(45) UNIQUE NOT NULL,
    courseCode VARCHAR(45) UNIQUE,
    description TEXT,
    filepath VARCHAR(45) UNIQUE
);

-- USER_COURSES TABLE (join table)
CREATE TABLE user_courses (
    userId INT NOT NULL,
    courseId INT NOT NULL,
    PRIMARY KEY (userId, courseId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
);

-- Access grant below
-- GRANT SELECT, INSERT, UPDATE, DELETE ON users, courses, user_courses TO {INSERT_USER};
-- GRANT USAGE, SELECT ON SEQUENCE courses_id_seq TO {INSERT_USER};
-- GRANT USAGE, SELECT ON SEQUENCE users_id_seq TO {INSERT_USER};