"""Environment configuration with defaults for the GAC Menu Editor backend."""
import os
from typing import List

from dotenv import load_dotenv

load_dotenv()  # load .env from working directory (project root or backend/)


class Settings:
    BASE_DIR: str = os.path.dirname(os.path.abspath(__file__))
    DATA_DIR: str = os.getenv("DATA_DIR", "./data")
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "0.0.0.0")
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8100"))
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")  # loaded from file at startup
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))
    ADMIN_DEFAULT_PASSWORD: str = os.getenv("ADMIN_DEFAULT_PASSWORD", "changeme123")
    LOGIN_RATE_LIMIT: int = int(os.getenv("LOGIN_RATE_LIMIT", "5"))
    LOCATIONS_FILE: str = os.getenv("LOCATIONS_FILE", "./data/locations.json")
    LOG_DIR: str = os.getenv("LOG_DIR", "./logs")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    ALLOWED_ORIGINS: List[str] = ["*"]
    APP_VERSION: str = "1.0.0"


settings = Settings()
