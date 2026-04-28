"""Image upload tests for the GAC Menu Editor backend.

Tests FR-I04, FR-I05, NFR-D02.
"""
import io
from PIL import Image


def _make_jpeg_bytes(size=(100, 100)) -> bytes:
    """Create a minimal JPEG image in memory."""
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=(200, 100, 50))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _make_png_bytes(size=(200, 150)) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=(50, 150, 200))
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_upload_jpeg(client, auth_headers, test_location):
    """FR-I05: Accept JPEG uploads; FR-I04: Convert to WebP."""
    jpeg_bytes = _make_jpeg_bytes()
    resp = client.post(
        f"/api/v1/locations/{test_location}/upload",
        headers=auth_headers,
        files={"file": ("test.jpg", jpeg_bytes, "image/jpeg")},
        data={"item_name": "Test Item", "category": "Seafood"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "image_path" in data
    assert data["image_path"].endswith(".webp")
    assert "uploaded_images" in data["image_path"]


def test_upload_png(client, auth_headers, test_location):
    """FR-I05: Accept PNG uploads."""
    png_bytes = _make_png_bytes()
    resp = client.post(
        f"/api/v1/locations/{test_location}/upload",
        headers=auth_headers,
        files={"file": ("test.png", png_bytes, "image/png")},
        data={"item_name": "PNG Item", "category": "Meat"},
    )
    assert resp.status_code == 200
    assert resp.json()["image_path"].endswith(".webp")


def test_upload_invalid_type_returns_400(client, auth_headers, test_location):
    """FR-I05: Reject unsupported file types."""
    resp = client.post(
        f"/api/v1/locations/{test_location}/upload",
        headers=auth_headers,
        files={"file": ("test.txt", b"not an image", "text/plain")},
        data={"item_name": "Bad Item", "category": "Seafood"},
    )
    assert resp.status_code == 400


def test_upload_file_too_large(client, auth_headers, test_location):
    """FR-I04: Enforce 10MB file size limit."""
    # Create a fake 11MB buffer
    large_bytes = b"x" * (11 * 1024 * 1024)
    resp = client.post(
        f"/api/v1/locations/{test_location}/upload",
        headers=auth_headers,
        files={"file": ("big.jpg", large_bytes, "image/jpeg")},
        data={"item_name": "Big Item", "category": "Seafood"},
    )
    assert resp.status_code == 400
    assert "10MB" in resp.json()["detail"]


def test_upload_resizes_large_image(client, auth_headers, test_location):
    """FR-I04: Images are resized to max 800px."""
    import os, config
    # Create a large 1200x900 JPEG
    large_jpeg = _make_jpeg_bytes(size=(1200, 900))
    resp = client.post(
        f"/api/v1/locations/{test_location}/upload",
        headers=auth_headers,
        files={"file": ("large.jpg", large_jpeg, "image/jpeg")},
        data={"item_name": "Large Item", "category": "Seafood"},
    )
    assert resp.status_code == 200
    image_path = resp.json()["image_path"]
    filename = os.path.basename(image_path)
    full_path = os.path.join(config.settings.DATA_DIR, "locations", test_location, "uploaded_images", filename)
    assert os.path.exists(full_path)
    saved_img = Image.open(full_path)
    assert max(saved_img.size) <= 800


def test_upload_invalid_location_returns_404(client, auth_headers):
    jpeg_bytes = _make_jpeg_bytes()
    resp = client.post(
        "/api/v1/locations/nonexistent/upload",
        headers=auth_headers,
        files={"file": ("test.jpg", jpeg_bytes, "image/jpeg")},
        data={"item_name": "Test", "category": "Seafood"},
    )
    assert resp.status_code == 404


def test_upload_requires_auth(client, test_location):
    jpeg_bytes = _make_jpeg_bytes()
    resp = client.post(
        f"/api/v1/locations/{test_location}/upload",
        files={"file": ("test.jpg", jpeg_bytes, "image/jpeg")},
        data={"item_name": "Test", "category": "Seafood"},
    )
    assert resp.status_code == 401
