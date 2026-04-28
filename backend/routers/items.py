"""Menu items router (location-scoped).

Implements FR-M01-M10, FR-I07, FR-I08 - full CRUD for menu items.
"""
import json
import logging
import os
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from config import settings
from routers.auth import get_current_user
from routers.locations import validate_location_exists, get_location_dir
from schemas import MenuItemCreate, MenuItemUpdate, MenuItemResponse
from services.backup import create_backup, restore_backup
from services.image_processor import delete_image_file

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["items"])


def generate_item_id(item_name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", item_name.lower()).strip("-")


def get_menu_path(location_id: str) -> str:
    return os.path.join(get_location_dir(location_id), "menu.json")


def read_menu(location_id: str) -> dict:
    path = get_menu_path(location_id)
    if not os.path.exists(path):
        return {"schema_version": "1.0", "items": []}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_menu(location_id: str, data: dict) -> None:
    path = get_menu_path(location_id)
    create_backup(path)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception:
        restore_backup(path)
        raise


@router.get("/locations/{location_id}/items/categories")
async def list_categories(location_id: str, current_user: dict = Depends(get_current_user)):
    """List distinct categories for a location."""
    validate_location_exists(location_id)
    menu = read_menu(location_id)
    categories = sorted(set(item["category"] for item in menu.get("items", []) if item.get("category")))
    return {"categories": categories}


@router.get("/locations/{location_id}/items")
async def list_items(
    location_id: str,
    search: str = "",
    category: str = "",
    current_user: dict = Depends(get_current_user),
):
    """List/search items for a location. Implements FR-M01, FR-M06, FR-M07."""
    validate_location_exists(location_id)
    menu = read_menu(location_id)
    items = menu.get("items", [])

    if category:
        items = [i for i in items if i.get("category", "").lower() == category.lower()]
    if search:
        q = search.lower()
        items = [
            i for i in items
            if q in i.get("item_name", "").lower() or q in (i.get("item_viet") or "").lower()
        ]

    return {"items": items, "total": len(items)}


@router.post("/locations/{location_id}/items")
async def create_item(
    location_id: str,
    body: MenuItemCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a menu item. Implements FR-M03, FR-M04, FR-M05."""
    validate_location_exists(location_id)
    item_id = generate_item_id(body.item_name)
    if not item_id:
        raise HTTPException(status_code=400, detail="Invalid item name")

    menu = read_menu(location_id)
    for existing in menu.get("items", []):
        if existing["item_id"] == item_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Item '{item_id}' already exists in this location",
            )

    new_item = {
        "item_id": item_id,
        "item_name": body.item_name,
        "item_viet": body.item_viet,
        "pronunciation": body.pronunciation,
        "description": body.description,
        "description_viet": body.description_viet,
        "price": body.price,
        "category": body.category,
        "popular": body.popular,
        "available": body.available,
        "image_path": body.image_path,
    }
    menu.setdefault("items", []).append(new_item)
    write_menu(location_id, menu)
    logger.info("Item created: %s in location: %s", item_id, location_id)
    return {"item": new_item, "message": "Item created"}


@router.put("/locations/{location_id}/items/{item_id}")
async def update_item(
    location_id: str,
    item_id: str,
    body: MenuItemUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a menu item. Implements FR-M02, FR-M05, FR-I07."""
    validate_location_exists(location_id)
    menu = read_menu(location_id)
    items = menu.get("items", [])

    for i, item in enumerate(items):
        if item["item_id"] == item_id:
            old_image_path = item.get("image_path")
            update_data = body.model_dump(exclude_unset=True)

            # item_id is immutable — ignore if provided
            update_data.pop("item_id", None)

            items[i].update(update_data)

            # Cleanup old image if image_path changed (FR-I07)
            new_image_path = items[i].get("image_path")
            if old_image_path and new_image_path != old_image_path:
                loc_dir = get_location_dir(location_id)
                delete_image_file(old_image_path, loc_dir)

            write_menu(location_id, menu)
            logger.info("Item updated: %s in location: %s", item_id, location_id)
            return {"item": items[i], "message": "Item updated"}

    raise HTTPException(status_code=404, detail=f"Item '{item_id}' not found")


@router.delete("/locations/{location_id}/items/{item_id}")
async def delete_item(
    location_id: str,
    item_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a menu item and its image. Implements FR-M08, FR-I08."""
    validate_location_exists(location_id)
    menu = read_menu(location_id)
    items = menu.get("items", [])

    for item in items:
        if item["item_id"] == item_id:
            # Cleanup image (FR-I08)
            image_path = item.get("image_path")
            if image_path:
                loc_dir = get_location_dir(location_id)
                delete_image_file(image_path, loc_dir)

            menu["items"] = [i for i in items if i["item_id"] != item_id]
            write_menu(location_id, menu)
            logger.info("Item deleted: %s from location: %s", item_id, location_id)
            return {"message": "Item deleted"}

    raise HTTPException(status_code=404, detail=f"Item '{item_id}' not found")
