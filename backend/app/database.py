import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path


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
                application_data TEXT NOT NULL DEFAULT '{}',
                documents_json TEXT NOT NULL DEFAULT '[]',
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
        application_columns = {row["name"] for row in database.execute("PRAGMA table_info(applications)")}
        if "application_data" not in application_columns:
            database.execute("ALTER TABLE applications ADD COLUMN application_data TEXT NOT NULL DEFAULT '{}'")
        if "documents_json" not in application_columns:
            database.execute("ALTER TABLE applications ADD COLUMN documents_json TEXT NOT NULL DEFAULT '[]'")
