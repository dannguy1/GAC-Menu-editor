"""SQLite admin user management for the GAC Menu Editor backend.

Implements FR-A01, FR-A02, NFR-S01 - admin credential storage with bcrypt.
"""
import sqlite3
import logging
import os
from passlib.context import CryptContext
from config import settings

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_db_path() -> str:
    return os.path.join(settings.DATA_DIR, "admin.db")


def init_db() -> None:
    """Initialize admin database. Creates default admin user on first run."""
    db_path = get_db_path()
    is_new = not os.path.exists(db_path)
    conn = sqlite3.connect(db_path, check_same_thread=False)
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                password_is_default INTEGER NOT NULL DEFAULT 1
            )
        """)
        conn.commit()
        if is_new:
            _create_default_admin(conn)
            logger.info("Admin database initialized with default user")
        else:
            # Ensure default user exists (idempotent)
            row = conn.execute("SELECT id FROM users WHERE username = 'admin'").fetchone()
            if not row:
                _create_default_admin(conn)
                logger.info("Default admin user re-created")
    finally:
        conn.close()


def _create_default_admin(conn: sqlite3.Connection) -> None:
    hashed = pwd_context.hash(settings.ADMIN_DEFAULT_PASSWORD)
    conn.execute(
        "INSERT OR IGNORE INTO users (username, hashed_password, password_is_default) VALUES (?, ?, 1)",
        ("admin", hashed),
    )
    conn.commit()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def get_user(username: str) -> dict | None:
    conn = sqlite3.connect(get_db_path(), check_same_thread=False)
    try:
        row = conn.execute(
            "SELECT username, hashed_password, password_is_default FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if row:
            return {
                "username": row[0],
                "hashed_password": row[1],
                "password_is_default": bool(row[2]),
            }
        return None
    finally:
        conn.close()


def update_password(username: str, new_hashed: str) -> None:
    conn = sqlite3.connect(get_db_path(), check_same_thread=False)
    try:
        conn.execute(
            "UPDATE users SET hashed_password = ?, password_is_default = 0 WHERE username = ?",
            (new_hashed, username),
        )
        conn.commit()
        logger.info("Password updated for user: %s", username)
    finally:
        conn.close()
