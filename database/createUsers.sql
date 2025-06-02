-- DO NOT USE ANYMORE, USE SIGNUP BUTTON FOR HASHING
-- Insert a professor
-- INSERT INTO users (username, password, role)
-- VALUES ('prof', 'prof123', 1);  -- role = 1 for professor

-- -- Insert a student
-- INSERT INTO users (username, password, role)
-- VALUES ('stu', 'stu123', 0);  -- role = 0 for student

UPDATE users
SET role = 1
WHERE username = 'prof';