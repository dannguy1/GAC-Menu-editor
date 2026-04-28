"""Image processing service: resize, WebP conversion, filename sanitization.

Implements FR-I04, FR-I05 - image processing pipeline.
"""
import re
import logging
import os
from io import BytesIO
from PIL import Image

logger = logging.getLogger(__name__)

MAX_DIMENSION = 800
WEBP_QUALITY = 85
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _register_heif():
    """Register HEIC/HEIF support with Pillow if available."""
    try:
        import pillow_heif
        pillow_heif.register_heif_opener()
    except ImportError:
        logger.warning("pillow-heif not installed; HEIC/HEIF support unavailable")


_register_heif()


def sanitize_filename_part(text: str) -> str:
    """Convert text to a safe filename component."""
    text = text.strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "_", text)
    return text[:50]


def generate_image_filename(category: str, item_name: str) -> str:
    """Generate filename: {Category}_{Sanitized_Name}.webp"""
    safe_category = sanitize_filename_part(category)
    safe_name = sanitize_filename_part(item_name)
    return f"{safe_category}_{safe_name}.webp"


def process_image(file_bytes: bytes, content_type: str, category: str, item_name: str) -> tuple[bytes, str]:
    """Process an uploaded image: validate, resize, convert to WebP.

    Returns (processed_bytes, filename).
    Raises ValueError on invalid type or processing failure.
    """
    if content_type.lower() not in ALLOWED_MIME_TYPES:
        raise ValueError(f"Unsupported image type: {content_type}. Allowed: JPEG, PNG, WebP, HEIC")

    try:
        img = Image.open(BytesIO(file_bytes))
        img = img.convert("RGB")

        # Resize to max 800px on longest edge
        w, h = img.size
        if w > MAX_DIMENSION or h > MAX_DIMENSION:
            ratio = MAX_DIMENSION / max(w, h)
            new_size = (int(w * ratio), int(h * ratio))
            img = img.resize(new_size, Image.LANCZOS)
            logger.debug("Resized image from %dx%d to %dx%d", w, h, *new_size)

        # Convert to WebP
        output = BytesIO()
        img.save(output, format="WEBP", quality=WEBP_QUALITY, method=6)
        processed_bytes = output.getvalue()

        filename = generate_image_filename(category, item_name)
        logger.info("Image processed: %s (%d bytes)", filename, len(processed_bytes))
        return processed_bytes, filename

    except Exception as exc:
        logger.error("Image processing failed: %s", exc)
        raise ValueError(f"Image processing failed: {exc}") from exc


def save_image(processed_bytes: bytes, filename: str, upload_dir: str) -> str:
    """Save processed image bytes to upload_dir. Returns relative path."""
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        f.write(processed_bytes)
    logger.info("Image saved: %s", filepath)
    return f"./uploaded_images/{filename}"


def delete_image_file(image_path: str, location_dir: str) -> None:
    """Delete an image file given its relative path and the location directory."""
    if not image_path:
        return
    # image_path is like "./uploaded_images/Seafood_Honey_Walnut.webp"
    filename = os.path.basename(image_path)
    # Only allow deletion from uploaded_images
    if "uploaded_images" not in image_path:
        logger.warning("Skipping deletion of non-uploaded image: %s", image_path)
        return
    filepath = os.path.join(location_dir, "uploaded_images", filename)
    # Prevent path traversal
    real_path = os.path.realpath(filepath)
    real_base = os.path.realpath(os.path.join(location_dir, "uploaded_images"))
    if not real_path.startswith(real_base):
        logger.error("Path traversal attempt blocked: %s", image_path)
        return
    if os.path.exists(filepath):
        os.remove(filepath)
        logger.info("Deleted image file: %s", filepath)
    else:
        logger.debug("Image file not found for deletion: %s", filepath)
