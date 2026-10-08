--1. CREATE TABLES 
PRAGMA foreign_keys = ON;

CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  credits INTEGER NOT NULL
);

CREATE TABLE enrolments (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  grade INTEGER,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  UNIQUE (student_id, course_id)
);

-- 2. INSERT DATA 
INSERT INTO students (name, email) VALUES
  ('Amina Hassan', 'amina@school.com'),
  ('Brian Otieno', 'brian@school.com'),
  ('Carol Wanjiru', 'carol@school.com'),
  ('David Kimani', 'david@school.com');

INSERT INTO courses (title, credits) VALUES
  ('Web Foundations', 3),
  ('Databases', 4),
  ('Mathematics', 3);

INSERT INTO enrolments (student_id, course_id, grade) VALUES
  (1, 1, 85),
  (1, 2, 78),
  (2, 1, 90),
  (3, 1, 72),
  (3, 3, 88),
  (2, 3, 65);

-- 3. QUERIES 

-- Query 1: all courses for one student (by name)
SELECT courses.title, enrolments.grade
FROM students
JOIN enrolments ON students.id = enrolments.student_id
JOIN courses ON courses.id = enrolments.course_id
WHERE students.name = 'Amina Hassan';

-- Query 2: all students on one course
SELECT students.name, students.email
FROM courses
JOIN enrolments ON courses.id = enrolments.course_id
JOIN students ON students.id = enrolments.student_id
WHERE courses.title = 'Web Foundations';

-- Query 3: number of students per course
SELECT courses.title, COUNT(enrolments.id) AS number_of_students
FROM courses
LEFT JOIN enrolments ON courses.id = enrolments.course_id
GROUP BY courses.id;

-- Query 4: students who have no enrolments
SELECT students.name
FROM students
LEFT JOIN enrolments ON students.id = enrolments.student_id
WHERE enrolments.id IS NULL;

-- Query 5: update one enrolment's grade (Brian, Mathematics)
UPDATE enrolments
SET grade = 70
WHERE student_id = 2 AND course_id = 3;