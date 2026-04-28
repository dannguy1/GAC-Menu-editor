"""GAC Menu Editor — FastAPI application entry point.

Implements NFR-S07 (CORS), NFR-R04 (logging), first-run initialization.
"""
import json
import logging
import logging.handlers
import os
import secrets

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings


def setup_logging() -> None:
    """Configure rotating file handlers for app and error logs. Implements NFR-R04."""
    os.makedirs(settings.LOG_DIR, exist_ok=True)
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # App log — all messages
    app_handler = logging.handlers.RotatingFileHandler(
        os.path.join(settings.LOG_DIR, "app.log"),
        maxBytes=5 * 1024 * 1024,
        backupCount=3,
        encoding="utf-8",
    )
    app_handler.setFormatter(formatter)
    app_handler.setLevel(log_level)

    # Error log — errors only
    error_handler = logging.handlers.RotatingFileHandler(
        os.path.join(settings.LOG_DIR, "error.log"),
        maxBytes=5 * 1024 * 1024,
        backupCount=3,
        encoding="utf-8",
    )
    error_handler.setFormatter(formatter)
    error_handler.setLevel(logging.ERROR)

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(log_level)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.addHandler(app_handler)
    root_logger.addHandler(error_handler)
    root_logger.addHandler(console_handler)


def first_run_init() -> None:
    """Create data directories, JWT secret, and initialize admin DB on first run.

    Implements docs/02_System_Design.md §12.
    """
    logger = logging.getLogger(__name__)

    # Create data directories
    os.makedirs(settings.DATA_DIR, exist_ok=True)
    os.makedirs(os.path.join(settings.DATA_DIR, "locations"), exist_ok=True)

    # Initialize empty locations.json if missing
    locations_file = settings.LOCATIONS_FILE
    if not os.path.exists(locations_file):
        with open(locations_file, "w", encoding="utf-8") as f:
            json.dump({"locations": []}, f, indent=2)
        logger.info("Initialized empty locations.json")

    # Generate and persist JWT secret (NFR-S06)
    jwt_secret_path = os.path.join(settings.DATA_DIR, ".jwt_secret")
    if not os.path.exists(jwt_secret_path):
        secret = secrets.token_hex(32)
        fd = os.open(jwt_secret_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as f:
            f.write(secret)
        logger.info("Generated new JWT secret")
    else:
        with open(jwt_secret_path) as f:
            secret = f.read().strip()

    # Override settings with persisted secret
    settings.JWT_SECRET_KEY = secret

    # Initialize admin database
    from database import init_db
    init_db()
    logger.info("First-run initialization complete")


def create_app() -> FastAPI:
    setup_logging()
    first_run_init()

    logger = logging.getLogger(__name__)

    app = FastAPI(
        title="GAC Menu Editor API",
        description="Backend API for the Garlic & Chives Menu Editor",
        version=settings.APP_VERSION,
    )

    # CORS — allow all origins for LAN-only app (NFR-S07)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers
    from routers import auth, locations, items, facts, upload, deploy, export, import_data, clear_location
    app.include_router(auth.router)
    app.include_router(locations.router)
    app.include_router(items.router)
    app.include_router(facts.router)
    app.include_router(upload.router)
    app.include_router(deploy.router)
    app.include_router(export.router)
    app.include_router(import_data.router)
    app.include_router(clear_location.router)

    # Optional rate limiting via slowapi (FR-A08, Could priority for LAN-only)
    if auth.USE_RATE_LIMIT and auth.limiter:
        from slowapi import _rate_limit_exceeded_handler
        from slowapi.errors import RateLimitExceeded
        app.state.limiter = auth.limiter
        app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
        logger.info("Rate limiting enabled on login endpoint: %s", auth._rate_limit)

    # Single static file mount for all locations (including future ones) — Task 1.9 design note
    locations_data_dir = os.path.join(settings.DATA_DIR, "locations")
    os.makedirs(locations_data_dir, exist_ok=True)
    app.mount("/locations", StaticFiles(directory=locations_data_dir), name="locations")

    @app.get("/api/v1/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "ok", "version": settings.APP_VERSION}

    logger.info("GAC Menu Editor backend started on %s:%s", settings.BACKEND_HOST, settings.BACKEND_PORT)
    return app


app = create_app()
