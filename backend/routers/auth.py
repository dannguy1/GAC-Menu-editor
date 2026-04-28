"""Authentication router: login, password change, JWT dependency.

Implements FR-A01-A07, NFR-S01, NFR-S02.
"""
import logging
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from config import settings
from database import get_user, verify_password, hash_password, update_password
from schemas import TokenRequest, TokenResponse, PasswordChange

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["auth"])
security = HTTPBearer(auto_error=False)

# Optional rate limiting via slowapi (FR-A08, Could priority for LAN-only)
# Disabled by setting DISABLE_RATE_LIMIT=1 (e.g., in tests)
_disable_rate_limit = os.environ.get("DISABLE_RATE_LIMIT", "").strip() in ("1", "true", "yes")
try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    if _disable_rate_limit:
        raise ImportError("Rate limiting disabled by DISABLE_RATE_LIMIT env var")
    limiter = Limiter(key_func=get_remote_address)
    _rate_limit = f"{settings.LOGIN_RATE_LIMIT}/minute"
    USE_RATE_LIMIT = True
except ImportError:
    limiter = None
    _rate_limit = None
    USE_RATE_LIMIT = False


def _create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """JWT dependency for protected routes."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user = get_user(username)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired or invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _optional_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict | None:
    """Optional JWT dependency — returns user or None (no error)."""
    if not credentials:
        return None
    try:
        return get_current_user(credentials)
    except HTTPException:
        return None


if USE_RATE_LIMIT:
    @router.post("/auth/token", response_model=TokenResponse)
    @limiter.limit(_rate_limit)
    async def login(request: Request, body: TokenRequest):
        """Authenticate user and return JWT token. Implements FR-A01-A03, FR-A08."""
        user = get_user(body.username)
        if not user or not verify_password(body.password, user["hashed_password"]):
            logger.warning("Failed login attempt for username: %s", body.username)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        token = _create_access_token({"sub": user["username"]})
        logger.info("User logged in: %s", user["username"])
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            password_is_default=user["password_is_default"],
        )
else:
    @router.post("/auth/token", response_model=TokenResponse)
    async def login(request: Request, body: TokenRequest):
        """Authenticate user and return JWT token. Implements FR-A01-A03."""
        user = get_user(body.username)
        if not user or not verify_password(body.password, user["hashed_password"]):
            logger.warning("Failed login attempt for username: %s", body.username)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        token = _create_access_token({"sub": user["username"]})
        logger.info("User logged in: %s", user["username"])
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            password_is_default=user["password_is_default"],
        )


@router.put("/auth/password")
async def change_password(body: PasswordChange, current_user: dict = Depends(get_current_user)):
    """Change admin password. Implements FR-A05."""
    if not verify_password(body.current_password, current_user["hashed_password"]):
        logger.warning("Password change failed for user: %s (wrong current password)", current_user["username"])
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    new_hashed = hash_password(body.new_password)
    update_password(current_user["username"], new_hashed)
    logger.info("Password changed for user: %s", current_user["username"])
    return {"message": "Password updated"}
