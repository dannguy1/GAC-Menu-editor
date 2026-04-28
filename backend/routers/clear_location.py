"""Clear all data for a location (menu items, facts, images).

Utility endpoint for testing and correcting mistakes — resets a location's
data files back to empty while preserving the location registration itself.
"""
import json
import logging
import os
import shutil

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from config import settings
from routers.auth import get_current_user
from routers.locations import validate_location_exists, get_location_dir
from services.backup import create_backup

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["admin"])


class ClearRequest(BaseModel):
    clear_menu: bool = Field(default=True, description="Reset menu.json to empty items list")
    clear_facts: bool = Field(default=True, description="Reset facts.json to empty facts list")
    clear_images: bool = Field(default=True, description="Delete all image files")
    confirm: bool = Field(
        default=False,
        description="Safety flag — must be true to proceed. Prevents accidental clears.",
    )


class ClearResponse(BaseModel):
    location_id: str
    menu_cleared: bool = False
    menu_items_removed: int = 0
    facts_cleared: bool = False
    facts_removed: int = 0
    images_cleared: bool = False
    images_removed: int = 0


@router.post(
    "/locations/{location_id}/clear",
    response_model=ClearResponse,
    status_code=status.HTTP_200_OK,
)
async def clear_location_data(
    location_id: str,
    body: ClearRequest,
    current_user: dict = Depends(get_current_user),
):
    """Clear data for a location. Requires confirm=true as a safety check."""
    validate_location_exists(location_id)

    if not body.confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Safety check: set confirm=true to proceed with clearing data",
        )

    loc_dir = get_location_dir(location_id)
    result = ClearResponse(location_id=location_id)

    # Clear menu items
    if body.clear_menu:
        menu_path = os.path.join(loc_dir, "menu.json")
        if os.path.exists(menu_path):
            create_backup(menu_path)
            with open(menu_path, encoding="utf-8") as f:
                data = json.load(f)
            result.menu_items_removed = len(data.get("items", []))
            with open(menu_path, "w", encoding="utf-8") as f:
                json.dump({"schema_version": "1.0", "items": []}, f, indent=2, ensure_ascii=False)
        result.menu_cleared = True
        logger.info("Cleared %d menu items for location: %s", result.menu_items_removed, location_id)

    # Clear facts
    if body.clear_facts:
        facts_path = os.path.join(loc_dir, "facts.json")
        if os.path.exists(facts_path):
            create_backup(facts_path)
            with open(facts_path, encoding="utf-8") as f:
                data = json.load(f)
            result.facts_removed = len(data.get("facts", []))
            with open(facts_path, "w", encoding="utf-8") as f:
                json.dump({"schema_version": "1.0", "facts": []}, f, indent=2, ensure_ascii=False)
        result.facts_cleared = True
        logger.info("Cleared %d facts for location: %s", result.facts_removed, location_id)

    # Clear images
    if body.clear_images:
        total_removed = 0
        for img_dir_name in ["images", "downloaded_images", "uploaded_images"]:
            img_dir = os.path.join(loc_dir, img_dir_name)
            if os.path.isdir(img_dir):
                count = sum(1 for f in os.listdir(img_dir) if os.path.isfile(os.path.join(img_dir, f)))
                total_removed += count
                shutil.rmtree(img_dir)
                os.makedirs(img_dir, exist_ok=True)
        result.images_removed = total_removed
        result.images_cleared = True
        logger.info("Cleared %d image files for location: %s", total_removed, location_id)

    logger.info(
        "Location clear complete: %s — menu=%d items, facts=%d, images=%d files",
        location_id, result.menu_items_removed, result.facts_removed, result.images_removed,
    )
    return result
