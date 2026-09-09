import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any


DATABASE_PATH = Path(os.getenv("DATABASE_PATH", Path(__file__).resolve().parents[1] / "sheerwood.db"))


class PostgreSQLConnection:
    """Small compatibility layer for the existing SQLite-style query calls."""

    def __init__(self, database: Any):
        self._database = database

    def execute(self, statement: str, parameters: tuple[Any, ...] = ()):
        # The API was written with SQLite qmark placeholders; psycopg uses %s.
        # Application queries do not contain literal question marks, so this
        # keeps the query layer portable without interpolating any user input.
        return self._database.execute(statement.replace("?", "%s"), parameters)

    def commit(self) -> None:
        self._database.commit()

    def rollback(self) -> None:
        self._database.rollback()

    def close(self) -> None:
        self._database.close()


def postgres_configuration() -> dict[str, Any] | str | None:
    """Return PostgreSQL settings when RDS has been configured on the server.

    ``DATABASE_URL`` is useful for managed deployment platforms. The individual
    POSTGRES_* variables make it easier to configure an AWS RDS endpoint without
    putting an unescaped password into a URL. When neither is set, local SQLite
    remains available for development.
    """
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        if not database_url.startswith(("postgresql://", "postgres://")):
            raise RuntimeError("DATABASE_URL must use a postgresql:// or postgres:// URL.")
        return database_url

    host = os.getenv("POSTGRES_HOST", "").strip()
    if not host:
        return None

    required = {
        "POSTGRES_DATABASE": os.getenv("POSTGRES_DATABASE", "").strip(),
        "POSTGRES_USER": os.getenv("POSTGRES_USER", "").strip(),
        "POSTGRES_PASSWORD": os.getenv("POSTGRES_PASSWORD", "").strip(),
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise RuntimeError(f"PostgreSQL is missing required server settings: {', '.join(missing)}.")

    settings = {
        "host": host,
        "port": int(os.getenv("POSTGRES_PORT", "5432")),
        "dbname": required["POSTGRES_DATABASE"],
        "user": required["POSTGRES_USER"],
        "password": required["POSTGRES_PASSWORD"],
        "sslmode": os.getenv("POSTGRES_SSLMODE", "require").strip() or "require",
        "connect_timeout": int(os.getenv("POSTGRES_CONNECT_TIMEOUT", "5")),
    }
    root_certificate = os.getenv("POSTGRES_SSLROOTCERT", "").strip()
    if root_certificate:
        settings["sslrootcert"] = root_certificate
    return settings


@contextmanager
def connection():
    postgres_settings = postgres_configuration()
    if postgres_settings:
        try:
            import psycopg
            from psycopg.rows import dict_row
        except ImportError as error:
            raise RuntimeError("PostgreSQL support requires the 'psycopg' package. Install backend/requirements.txt.") from error

        database = psycopg.connect(postgres_settings, row_factory=dict_row) if isinstance(postgres_settings, str) else psycopg.connect(**postgres_settings, row_factory=dict_row)
        compatible_database = PostgreSQLConnection(database)
        try:
            yield compatible_database
            compatible_database.commit()
        except Exception:
            compatible_database.rollback()
            raise
        finally:
            compatible_database.close()
        return

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
    if postgres_configuration():
        initialize_postgres_database()
        return

    with connection() as database:
        database.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                full_name TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('parent', 'teacher', 'student', 'admin', 'admission')),
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
                section_allocation TEXT,
                verification_status TEXT NOT NULL DEFAULT 'pending',
                admin_remark TEXT NOT NULL DEFAULT '',
                reupload_reason TEXT NOT NULL DEFAULT '',
                verification_date TEXT,
                verified_by TEXT,
                approval_date TEXT,
                approved_by TEXT,
                approval_exception INTEGER NOT NULL DEFAULT 0,
                approval_exception_reason TEXT NOT NULL DEFAULT '',
                parent_id INTEGER,
                application_data TEXT NOT NULL DEFAULT '{}',
                documents_json TEXT NOT NULL DEFAULT '[]',
                registration_fee_status TEXT NOT NULL DEFAULT 'pending',
                registration_fee_paid_at TEXT,
                FOREIGN KEY(parent_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS new_admissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_number TEXT NOT NULL UNIQUE,
                parent_id INTEGER,
                academic_session TEXT,
                application_date TEXT,
                class_applying_for TEXT,
                pen_number TEXT,
                previous_school TEXT,
                current_class TEXT,
                board TEXT,
                medium TEXT,
                student_name TEXT NOT NULL DEFAULT 'Application in progress',
                status TEXT NOT NULL DEFAULT 'draft',
                documents_status TEXT NOT NULL DEFAULT 'pending',
                verification_status TEXT NOT NULL DEFAULT 'pending',
                admin_remark TEXT NOT NULL DEFAULT '',
                reupload_reason TEXT NOT NULL DEFAULT '',
                verification_date TEXT,
                verified_by TEXT,
                approval_date TEXT,
                approved_by TEXT,
                approval_exception INTEGER NOT NULL DEFAULT 0,
                approval_exception_reason TEXT NOT NULL DEFAULT '',
                section_allocation TEXT,
                application_data TEXT NOT NULL DEFAULT '{}',
                documents_json TEXT NOT NULL DEFAULT '[]',
                registration_fee_status TEXT NOT NULL DEFAULT 'pending',
                registration_fee_paid_at TEXT,
                submitted_on TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(parent_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS admission_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_number TEXT NOT NULL,
                parent_id INTEGER NOT NULL,
                document_key TEXT NOT NULL,
                file_name TEXT NOT NULL,
                content_type TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                sha256 TEXT NOT NULL,
                file_content BLOB NOT NULL,
                status TEXT NOT NULL DEFAULT 'submitted',
                reason TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(application_number, document_key),
                FOREIGN KEY(parent_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_code TEXT NOT NULL UNIQUE,
                full_name TEXT NOT NULL,
                class_section TEXT NOT NULL,
                attendance_percent REAL NOT NULL,
                parent_name TEXT NOT NULL,
                parent_phone TEXT NOT NULL,
                admission_id INTEGER,
                roll_number TEXT,
                email TEXT,
                enrollment_status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(admission_id) REFERENCES new_admissions(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS teachers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE,
                employee_code TEXT UNIQUE,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE,
                phone TEXT,
                subject TEXT,
                class_teacher TEXT,
                attendance_percent REAL NOT NULL DEFAULT 0,
                employment_status TEXT NOT NULL DEFAULT 'active',
                joined_on TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE,
                employee_code TEXT UNIQUE,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE,
                phone TEXT,
                access_level TEXT NOT NULL DEFAULT 'admin',
                employment_status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
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

        user_table_sql = database.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").fetchone()
        if user_table_sql and "CHECK(role IN ('parent', 'teacher', 'admin'))" in user_table_sql["sql"]:
            database.execute("ALTER TABLE users RENAME TO users_legacy")
            database.execute(
                """
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE,
                    full_name TEXT NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('parent', 'teacher', 'student', 'admin', 'admission')),
                    password_hash TEXT NOT NULL,
                    cognito_subject TEXT UNIQUE,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            database.execute(
                """
                INSERT INTO users (id, email, full_name, role, password_hash, cognito_subject, created_at)
                SELECT id, email, full_name, role, password_hash, cognito_subject, created_at FROM users_legacy
                """
            )
            database.execute("DROP TABLE users_legacy")
            database.execute("CREATE UNIQUE INDEX IF NOT EXISTS users_cognito_subject_idx ON users(cognito_subject) WHERE cognito_subject IS NOT NULL")
        application_columns = {row["name"] for row in database.execute("PRAGMA table_info(applications)")}
        if "application_data" not in application_columns:
            database.execute("ALTER TABLE applications ADD COLUMN application_data TEXT NOT NULL DEFAULT '{}'")
        if "documents_json" not in application_columns:
            database.execute("ALTER TABLE applications ADD COLUMN documents_json TEXT NOT NULL DEFAULT '[]'")
        for column, definition in (
            ("section_allocation", "TEXT"),
            ("verification_status", "TEXT NOT NULL DEFAULT 'pending'"),
            ("admin_remark", "TEXT NOT NULL DEFAULT ''"),
            ("reupload_reason", "TEXT NOT NULL DEFAULT ''"),
            ("verification_date", "TEXT"),
            ("verified_by", "TEXT"),
            ("approval_date", "TEXT"),
            ("approved_by", "TEXT"),
            ("approval_exception", "INTEGER NOT NULL DEFAULT 0"),
            ("approval_exception_reason", "TEXT NOT NULL DEFAULT ''"),
            ("registration_fee_status", "TEXT NOT NULL DEFAULT 'pending'"),
            ("registration_fee_paid_at", "TEXT"),
        ):
            if column not in application_columns:
                database.execute(f"ALTER TABLE applications ADD COLUMN {column} {definition}")
        admission_columns = {row["name"] for row in database.execute("PRAGMA table_info(new_admissions)")}
        for column, definition in (
            ("verification_status", "TEXT NOT NULL DEFAULT 'pending'"),
            ("admin_remark", "TEXT NOT NULL DEFAULT ''"),
            ("reupload_reason", "TEXT NOT NULL DEFAULT ''"),
            ("verification_date", "TEXT"),
            ("verified_by", "TEXT"),
            ("approval_date", "TEXT"),
            ("approved_by", "TEXT"),
            ("approval_exception", "INTEGER NOT NULL DEFAULT 0"),
            ("approval_exception_reason", "TEXT NOT NULL DEFAULT ''"),
            ("section_allocation", "TEXT"),
            ("registration_fee_status", "TEXT NOT NULL DEFAULT 'pending'"),
            ("registration_fee_paid_at", "TEXT"),
        ):
            if column not in admission_columns:
                database.execute(f"ALTER TABLE new_admissions ADD COLUMN {column} {definition}")
        student_columns = {row["name"] for row in database.execute("PRAGMA table_info(students)")}
        for column, definition in (
            ("admission_id", "INTEGER"),
            ("roll_number", "TEXT"),
            ("email", "TEXT"),
            ("enrollment_status", "TEXT NOT NULL DEFAULT 'active'"),
            ("created_at", "TEXT"),
            ("updated_at", "TEXT"),
        ):
            if column not in student_columns:
                database.execute(f"ALTER TABLE students ADD COLUMN {column} {definition}")
        database.execute("CREATE INDEX IF NOT EXISTS new_admissions_parent_status_idx ON new_admissions(parent_id, status)")
        database.execute("CREATE INDEX IF NOT EXISTS admission_documents_parent_idx ON admission_documents(parent_id, application_number)")
        database.execute("CREATE INDEX IF NOT EXISTS students_class_section_idx ON students(class_section)")
        database.execute("CREATE INDEX IF NOT EXISTS teachers_status_idx ON teachers(employment_status)")
        database.execute("CREATE INDEX IF NOT EXISTS admins_status_idx ON admins(employment_status)")


def initialize_postgres_database() -> None:
    """Create and upgrade the schema used by the FastAPI API on PostgreSQL."""
    statements = (
        """
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('parent', 'teacher', 'student', 'admin', 'admission')),
            password_hash TEXT NOT NULL,
            cognito_subject TEXT UNIQUE,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
            expires_at TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS applications (
            id BIGSERIAL PRIMARY KEY,
            application_number TEXT NOT NULL UNIQUE,
            student_name TEXT NOT NULL,
            parent_name TEXT NOT NULL,
            desired_class TEXT NOT NULL,
            status TEXT NOT NULL,
            documents_status TEXT NOT NULL,
            submitted_on TEXT NOT NULL,
            class_section TEXT,
            section_allocation TEXT,
            verification_status TEXT NOT NULL DEFAULT 'pending',
            admin_remark TEXT NOT NULL DEFAULT '',
            reupload_reason TEXT NOT NULL DEFAULT '',
            verification_date TEXT,
            verified_by TEXT,
            approval_date TEXT,
            approved_by TEXT,
            approval_exception INTEGER NOT NULL DEFAULT 0,
            approval_exception_reason TEXT NOT NULL DEFAULT '',
            parent_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
            application_data TEXT NOT NULL DEFAULT '{}',
            documents_json TEXT NOT NULL DEFAULT '[]',
            registration_fee_status TEXT NOT NULL DEFAULT 'pending',
            registration_fee_paid_at TEXT
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS new_admissions (
            id BIGSERIAL PRIMARY KEY,
            application_number TEXT NOT NULL UNIQUE,
            parent_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
            academic_session TEXT,
            application_date TEXT,
            class_applying_for TEXT,
            pen_number TEXT,
            previous_school TEXT,
            current_class TEXT,
            board TEXT,
            medium TEXT,
            student_name TEXT NOT NULL DEFAULT 'Application in progress',
            status TEXT NOT NULL DEFAULT 'draft',
            documents_status TEXT NOT NULL DEFAULT 'pending',
            verification_status TEXT NOT NULL DEFAULT 'pending',
            admin_remark TEXT NOT NULL DEFAULT '',
            reupload_reason TEXT NOT NULL DEFAULT '',
            verification_date TEXT,
            verified_by TEXT,
            approval_date TEXT,
            approved_by TEXT,
            approval_exception INTEGER NOT NULL DEFAULT 0,
            approval_exception_reason TEXT NOT NULL DEFAULT '',
            section_allocation TEXT,
            application_data TEXT NOT NULL DEFAULT '{}',
            documents_json TEXT NOT NULL DEFAULT '[]',
            registration_fee_status TEXT NOT NULL DEFAULT 'pending',
            registration_fee_paid_at TEXT,
            submitted_on TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS admission_documents (
            id BIGSERIAL PRIMARY KEY,
            application_number TEXT NOT NULL,
            parent_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            document_key TEXT NOT NULL,
            file_name TEXT NOT NULL,
            content_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            sha256 TEXT NOT NULL,
            file_content BYTEA NOT NULL,
            status TEXT NOT NULL DEFAULT 'submitted',
            reason TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
            UNIQUE(application_number, document_key)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS students (
            id BIGSERIAL PRIMARY KEY,
            student_code TEXT NOT NULL UNIQUE,
            full_name TEXT NOT NULL,
            class_section TEXT NOT NULL,
            attendance_percent DOUBLE PRECISION NOT NULL,
            parent_name TEXT NOT NULL,
            parent_phone TEXT NOT NULL,
            admission_id BIGINT REFERENCES new_admissions(id) ON DELETE SET NULL,
            roll_number TEXT,
            email TEXT,
            enrollment_status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS teachers (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
            employee_code TEXT UNIQUE,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE,
            phone TEXT,
            subject TEXT,
            class_teacher TEXT,
            attendance_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
            employment_status TEXT NOT NULL DEFAULT 'active',
            joined_on TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS admins (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
            employee_code TEXT UNIQUE,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE,
            phone TEXT,
            access_level TEXT NOT NULL DEFAULT 'admin',
            employment_status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS otp_codes (
            phone_number TEXT PRIMARY KEY,
            code_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS email_otp_codes (
            email TEXT PRIMARY KEY,
            code_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0
        )
        """,
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS cognito_subject TEXT",
        "CREATE UNIQUE INDEX IF NOT EXISTS users_cognito_subject_idx ON users(cognito_subject) WHERE cognito_subject IS NOT NULL",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS application_data TEXT NOT NULL DEFAULT '{}'",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS documents_json TEXT NOT NULL DEFAULT '[]'",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS section_allocation TEXT",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending'",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS admin_remark TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS reupload_reason TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS verification_date TEXT",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS verified_by TEXT",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS approval_date TEXT",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS approved_by TEXT",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS approval_exception INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS approval_exception_reason TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS registration_fee_status TEXT NOT NULL DEFAULT 'pending'",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS registration_fee_paid_at TEXT",
        "ALTER TABLE new_admissions ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending'",
        "ALTER TABLE new_admissions ADD COLUMN IF NOT EXISTS admin_remark TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE new_admissions ADD COLUMN IF NOT EXISTS reupload_reason TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE new_admissions ADD COLUMN IF NOT EXISTS verification_date TEXT",
        "ALTER TABLE new_admissions ADD COLUMN IF NOT EXISTS verified_by TEXT",
        "ALTER TABLE new_admissions ADD COLUMN IF NOT EXISTS approval_date TEXT",
        "ALTER TABLE new_admissions ADD COLUMN IF NOT EXISTS approved_by TEXT",
        "ALTER TABLE new_admissions ADD COLUMN IF NOT EXISTS approval_exception INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE new_admissions ADD COLUMN IF NOT EXISTS approval_exception_reason TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE new_admissions ADD COLUMN IF NOT EXISTS section_allocation TEXT",
        "ALTER TABLE new_admissions ADD COLUMN IF NOT EXISTS registration_fee_status TEXT NOT NULL DEFAULT 'pending'",
        "ALTER TABLE new_admissions ADD COLUMN IF NOT EXISTS registration_fee_paid_at TEXT",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_id BIGINT REFERENCES new_admissions(id) ON DELETE SET NULL",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS roll_number TEXT",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS email TEXT",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS enrollment_status TEXT NOT NULL DEFAULT 'active'",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text",
        "CREATE INDEX IF NOT EXISTS new_admissions_parent_status_idx ON new_admissions(parent_id, status)",
        "CREATE INDEX IF NOT EXISTS admission_documents_parent_idx ON admission_documents(parent_id, application_number)",
        "CREATE INDEX IF NOT EXISTS students_class_section_idx ON students(class_section)",
        "CREATE INDEX IF NOT EXISTS teachers_status_idx ON teachers(employment_status)",
        "CREATE INDEX IF NOT EXISTS admins_status_idx ON admins(employment_status)",
    )
    with connection() as database:
        for statement in statements:
            database.execute(statement)
