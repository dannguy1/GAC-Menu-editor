"""Read-only consumer endpoints and ZIP export.

Implements FR-P01, FR-P02, FR-P03, NFR-C03 - public menu data access and export.
"""
import hashlib
import io
import json
import logging
import os
import zipfile
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from config import settings
from routers.auth import get_current_user
from routers.locations import validate_location_exists, get_location_dir

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["export"])


def _hash_file(path: str) -> str:
    if not os.path.exists(path):
        return ""
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()[:16]


@router.get("/locations/{location_id}/menu")
async def get_menu(location_id: str):
    """Public read-only endpoint: returns full menu. Implements FR-P02, NFR-C03."""
    validate_location_exists(location_id)
    menu_path = os.path.join(get_location_dir(location_id), "menu.json")
    if not os.path.exists(menu_path):
        return {"schema_version": "1.0", "items": []}
    with open(menu_path, encoding="utf-8") as f:
        return json.load(f)


@router.get("/locations/{location_id}/menu/facts")
async def get_facts_public(location_id: str):
    """Public read-only endpoint: returns full facts. Implements FR-P02, NFR-C03."""
    validate_location_exists(location_id)
    facts_path = os.path.join(get_location_dir(location_id), "facts.json")
    if not os.path.exists(facts_path):
        return {"schema_version": "1.0", "facts": []}
    with open(facts_path, encoding="utf-8") as f:
        return json.load(f)


@router.get("/locations/{location_id}/version")
async def get_version(location_id: str):
    """Public endpoint: data hashes for change detection. Implements FR-P07."""
    validate_location_exists(location_id)
    loc_dir = get_location_dir(location_id)
    menu_path = os.path.join(loc_dir, "menu.json")
    facts_path = os.path.join(loc_dir, "facts.json")

    menu_hash = _hash_file(menu_path)
    facts_hash = _hash_file(facts_path)

    last_modified = None
    for path in [menu_path, facts_path]:
        if os.path.exists(path):
            mtime = os.path.getmtime(path)
            ts = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()
            if last_modified is None or ts > last_modified:
                last_modified = ts

    return {
        "menu_hash": menu_hash,
        "facts_hash": facts_hash,
        "last_modified": last_modified,
    }


@router.get("/locations/{location_id}/export")
async def export_location(location_id: str, current_user: dict = Depends(get_current_user)):
    """JWT-protected ZIP export of all location data. Implements FR-P01, FR-DM03."""
    validate_location_exists(location_id)
    loc_dir = get_location_dir(location_id)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Add JSON files
        for filename in ["menu.json", "facts.json"]:
            path = os.path.join(loc_dir, filename)
            if os.path.exists(path):
                zf.write(path, filename)

        # Add images
        for img_dir in ["images", "downloaded_images", "uploaded_images"]:
            dir_path = os.path.join(loc_dir, img_dir)
            if os.path.exists(dir_path):
                for fname in os.listdir(dir_path):
                    fpath = os.path.join(dir_path, fname)
                    if os.path.isfile(fpath):
                        zf.write(fpath, os.path.join(img_dir, fname))

    buf.seek(0)
    logger.info("Export ZIP generated for location: %s", location_id)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{location_id}_export.zip"'},
    )
