"""Image upload router (location-scoped).

Implements FR-I01-I05 - image upload with validation and WebP conversion.
"""
import logging
import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from config import settings
from routers.auth import get_current_user
from routers.locations import validate_location_exists, get_location_dir
from services.image_processor import (
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE,
    process_image,
    save_image,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["upload"])


@router.post("/locations/{location_id}/upload")
async def upload_image(
    location_id: str,
    file: UploadFile = File(...),
    item_name: str = Form(...),
    category: str = Form(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload and process an image for a menu item. Implements FR-I01-I05.

    Returns the relative path to the processed WebP image.
    Note: old image cleanup is handled by PUT /items/{item_id}, not here.
    """
    validate_location_exists(location_id)

    # Read file bytes with streaming size enforcement to prevent memory exhaustion
    chunks = []
    total_size = 0
    while True:
        chunk = await file.read(64 * 1024)  # 64KB chunks
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File too large. Maximum size is 10MB.",
            )
        chunks.append(chunk)
    file_bytes = b"".join(chunks)

    # Validate file type
    content_type = (file.content_type or "").lower()
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()

    # Allow by content type or extension (HEIC files often come with octet-stream)
    if content_type not in {
        "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"
    } and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{content_type}'. Allowed: JPEG, PNG, WebP, HEIC",
        )

    # Map extension-based content type for HEIC
    if content_type in ("application/octet-stream", "") and ext in (".heic", ".heif"):
        content_type = "image/heic"
    elif content_type in ("application/octet-stream", "") and ext in (".jpg", ".jpeg"):
        content_type = "image/jpeg"
    elif content_type in ("application/octet-stream", "") and ext == ".png":
        content_type = "image/png"
    elif content_type in ("application/octet-stream", "") and ext == ".webp":
        content_type = "image/webp"

    try:
        processed_bytes, output_filename = process_image(file_bytes, content_type, category, item_name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    upload_dir = os.path.join(get_location_dir(location_id), "uploaded_images")
    image_path = save_image(processed_bytes, output_filename, upload_dir)

    logger.info("Image uploaded: %s for location: %s", output_filename, location_id)
    return {"image_path": image_path}
