# School Database Design

## Tables

### students
Stores one row per student: `id` (primary key), `name` and `email`. The email is `UNIQUE`, so two students cannot share one.

### courses
Stores one row per course: `id` (primary key), `title` and `credits`.

### enrolments
Stores the fact that a student is enrolled on a course. It has its own `id`, a `student_id` and a `course_id` (both foreign keys), and the `grade`. The grade is empty (`NULL`) until one is given. A `UNIQUE (student_id, course_id)` rule stops the same student enrolling on the same course twice.

## Relationships

- **One-to-many:** one student can have many enrolments, and one course can have many enrolments. Each enrolment belongs to exactly one student and one course.
- **Many-to-many:** students and courses. One student takes many courses, and one course has many students.
- **Why a join table is needed:** a table cannot store a list of courses in a single student cell. The `enrolments` table sits between the two and holds one row per student-course pair. It also has a natural place to store the grade, which belongs to the pair and not to the student or the course alone.

## Index

I would add an index on `enrolments(course_id)`:

```sql
CREATE INDEX idx_enrolments_course ON enrolments(course_id);
```

The reason is that queries like "all students on a course" and "students per course" search by `course_id`. Without an index the database checks every row. With an index it finds the matching rows quickly, which matters as the number of enrolments grows.

## SQL or NoSQL?

I would choose SQL for this system. School data is made of clear, connected records (students, courses and enrolments) with fixed fields, and the many-to-many relationship works well with joins. SQL also enforces rules for me, such as unique emails, foreign keys and no duplicate enrolments, which keeps the data correct. NoSQL could be useful if the data were very flexible or huge, but a school database is small and structured, so SQL is the simpler and safer choice.