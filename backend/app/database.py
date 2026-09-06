import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .security import hash_password

DATABASE_PATH = Path(os.getenv("DATABASE_PATH", Path(__file__).resolve().parents[1] / "sheerwood.db"))


@contextmanager
def connection():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    database = sqlite3.connect(DATABASE_PATH)
    database.row_factory = sqlite3.Row
    try:
        yield database
        database.commit()
    except Exception:
        database.rollback()
        raise
    finally:
        database.close()


def initialize_database() -> None:
    with connection() as database:
        database.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                full_name TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('parent', 'teacher', 'admin')),
                password_hash TEXT NOT NULL,
                cognito_subject TEXT UNIQUE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expires_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_number TEXT NOT NULL UNIQUE,
                student_name TEXT NOT NULL,
                parent_name TEXT NOT NULL,
                desired_class TEXT NOT NULL,
                status TEXT NOT NULL,
                documents_status TEXT NOT NULL,
                submitted_on TEXT NOT NULL,
                class_section TEXT,
                parent_id INTEGER,
                FOREIGN KEY(parent_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_code TEXT NOT NULL UNIQUE,
                full_name TEXT NOT NULL,
                class_section TEXT NOT NULL,
                attendance_percent REAL NOT NULL,
                parent_name TEXT NOT NULL,
                parent_phone TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS otp_codes (
                phone_number TEXT PRIMARY KEY,
                code_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS email_otp_codes (
                email TEXT PRIMARY KEY,
                code_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0
            );
            """
        )
        existing_columns = {row["name"] for row in database.execute("PRAGMA table_info(users)")}
        if "cognito_subject" not in existing_columns:
            database.execute("ALTER TABLE users ADD COLUMN cognito_subject TEXT")
            database.execute("CREATE UNIQUE INDEX IF NOT EXISTS users_cognito_subject_idx ON users(cognito_subject) WHERE cognito_subject IS NOT NULL")
        _seed_data(database)


def _seed_data(database: sqlite3.Connection) -> None:
    demo_users = [
        ("rajesh.sharma@demo.edu", "Rajesh Sharma", "parent", "Parent@123"),
        ("meera.kapoor@demo.edu", "Meera Kapoor", "teacher", "Teacher@123"),
        ("admin@demo.edu", "Sheerwood Admin", "admin", "Admin@123"),
    ]
    for email, name, role, password in demo_users:
        existing = database.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if not existing:
            database.execute(
                "INSERT INTO users (email, full_name, role, password_hash) VALUES (?, ?, ?, ?)",
                (email, name, role, hash_password(password)),
            )

    parent = database.execute("SELECT id FROM users WHERE email = ?", ("rajesh.sharma@demo.edu",)).fetchone()
    application_count = database.execute("SELECT COUNT(*) AS count FROM applications").fetchone()["count"]
    if application_count == 0:
        database.executemany(
            """INSERT INTO applications
            (application_number, student_name, parent_name, desired_class, status, documents_status, submitted_on, class_section, parent_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                ("AIS/2027-28/000124", "Aadhya Sharma", "Rajesh Sharma", "Class 2", "document_verification", "verified", "2027-05-26", None, parent["id"]),
                ("AIS/2027-28/000123", "Ananya Gupta", "Nitin Gupta", "Class 3", "new_application", "pending", "2027-05-25", None, None),
                ("AIS/2027-28/000125", "Vivaan Singh", "Pooja Singh", "Class 1", "pending_approval", "verified", "2027-05-24", "Class 1A", None),
                ("AIS/2027-28/000122", "Myra Patel", "Ravi Patel", "Class 2", "approved", "verified", "2027-05-22", "Class 2A", None),
            ],
        )

    student_count = database.execute("SELECT COUNT(*) AS count FROM students").fetchone()["count"]
    if student_count == 0:
        database.executemany(
            """INSERT INTO students (student_code, full_name, class_section, attendance_percent, parent_name, parent_phone)
            VALUES (?, ?, ?, ?, ?, ?)""",
            [
                ("STU-10424", "Aarav Sharma", "5A", 96, "Mrs. Sharma", "+91 98765 23120"),
                ("STU-10425", "Saanvi Gupta", "5A", 92, "Mr. Gupta", "+91 98765 16780"),
                ("STU-10426", "Vivaan Singh", "5A", 88, "Mrs. Singh", "+91 98765 44321"),
                ("STU-10427", "Riya Patel", "5B", 98, "Mr. Patel", "+91 98765 98001"),
            ],
        )
