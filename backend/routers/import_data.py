"""Import external menu data into a location.

Implements bulk import of menu.json, facts.json, and images from an
external data directory (e.g. ../GAC-Menu/data) into a Menu Editor location.
"""
import json
import logging
import os
import re
import shutil
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from config import settings
from routers.auth import get_current_user
from routers.locations import validate_location_exists, get_location_dir
from services.backup import create_backup

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["import"])


class ImportRequest(BaseModel):
    source_path: str = Field(
        min_length=1,
        description="Absolute path to the source data directory containing menu.json and/or facts.json",
    )
    import_menu: bool = Field(default=True, description="Import menu items")
    import_facts: bool = Field(default=True, description="Import facts")
    import_images: bool = Field(default=True, description="Copy image files")
    overwrite: bool = Field(
        default=False,
        description="If true, replace existing data. If false, merge (skip duplicates).",
    )


def _generate_item_id(item_name: str) -> str:
    """Generate a URL-safe slug from item name."""
    return re.sub(r"[^a-z0-9]+", "-", item_name.lower()).strip("-")


def _resolve_source_path(source_path: str) -> str:
    """Resolve and validate the source path, preventing path traversal attacks."""
    # Resolve relative to project root (parent of backend/)
    if not os.path.isabs(source_path):
        project_root = os.path.dirname(settings.BASE_DIR)
        source_path = os.path.join(project_root, source_path)

    resolved = os.path.realpath(source_path)

    # Restrict to project directory to prevent arbitrary filesystem reads
    project_root = os.path.realpath(os.path.dirname(settings.BASE_DIR))
    if not resolved.startswith(project_root + os.sep) and resolved != project_root:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source path must be within the project directory",
        )

    if not os.path.isdir(resolved):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Source path is not a directory: {resolved}",
        )

    return resolved


def _import_menu(source_dir: str, location_id: str, overwrite: bool) -> dict:
    """Import menu items from source menu.json into location."""
    source_menu = os.path.join(source_dir, "menu.json")
    if not os.path.exists(source_menu):
        return {"menu_status": "skipped", "reason": "No menu.json found in source"}

    with open(source_menu, encoding="utf-8") as f:
        source_data = json.load(f)

    source_items = source_data.get("items", [])
    if not source_items:
        return {"menu_status": "skipped", "reason": "No items in source menu.json"}

    # Read existing menu
    loc_dir = get_location_dir(location_id)
    menu_path = os.path.join(loc_dir, "menu.json")
    create_backup(menu_path)

    if os.path.exists(menu_path):
        with open(menu_path, encoding="utf-8") as f:
            existing_data = json.load(f)
    else:
        existing_data = {"schema_version": "1.0", "items": []}

    existing_ids = {item["item_id"] for item in existing_data.get("items", [])}

    if overwrite:
        existing_data["items"] = []
        existing_ids = set()

    imported = 0
    skipped = 0
    for src_item in source_items:
        item_name = src_item.get("item_name", "")
        if not item_name:
            skipped += 1
            continue

        item_id = _generate_item_id(item_name)
        if not item_id:
            skipped += 1
            continue

        if item_id in existing_ids:
            skipped += 1
            continue

        new_item = {
            "item_id": item_id,
            "item_name": item_name,
            "item_viet": src_item.get("item_viet"),
            "pronunciation": src_item.get("pronunciation"),
            "description": src_item.get("description", ""),
            "description_viet": src_item.get("description_viet"),
            "price": src_item.get("price", 0),
            "category": src_item.get("category", "Uncategorized"),
            "popular": src_item.get("popular", False),
            "available": src_item.get("available", True),
            "image_path": src_item.get("image_path"),
        }
        existing_data["items"].append(new_item)
        existing_ids.add(item_id)
        imported += 1

    with open(menu_path, "w", encoding="utf-8") as f:
        json.dump(existing_data, f, indent=2, ensure_ascii=False)

    return {"menu_status": "ok", "imported": imported, "skipped": skipped}


def _import_facts(source_dir: str, location_id: str, overwrite: bool) -> dict:
    """Import facts from source facts.json into location."""
    source_facts = os.path.join(source_dir, "facts.json")
    if not os.path.exists(source_facts):
        return {"facts_status": "skipped", "reason": "No facts.json found in source"}

    with open(source_facts, encoding="utf-8") as f:
        source_data = json.load(f)

    # Support both "facts" and "info" keys (GAC-Menu uses "info")
    source_facts_list = source_data.get("facts") or source_data.get("info", [])
    if not source_facts_list:
        return {"facts_status": "skipped", "reason": "No facts in source facts.json"}

    # Read existing facts
    loc_dir = get_location_dir(location_id)
    facts_path = os.path.join(loc_dir, "facts.json")
    create_backup(facts_path)

    if os.path.exists(facts_path):
        with open(facts_path, encoding="utf-8") as f:
            existing_data = json.load(f)
    else:
        existing_data = {"schema_version": "1.0", "facts": []}

    existing_topics = {fact.get("topic", "").lower() for fact in existing_data.get("facts", [])}

    if overwrite:
        existing_data["facts"] = []
        existing_topics = set()

    imported = 0
    skipped = 0
    for src_fact in source_facts_list:
        topic = src_fact.get("topic", "")
        if not topic:
            skipped += 1
            continue

        if topic.lower() in existing_topics:
            skipped += 1
            continue

        new_fact = {
            "fact_id": src_fact.get("fact_id") or str(uuid.uuid4()),
            "topic": topic,
            "content": src_fact.get("content", ""),
            "type": src_fact.get("type", "general_info"),
        }
        existing_data["facts"].append(new_fact)
        existing_topics.add(topic.lower())
        imported += 1

    with open(facts_path, "w", encoding="utf-8") as f:
        json.dump(existing_data, f, indent=2, ensure_ascii=False)

    return {"facts_status": "ok", "imported": imported, "skipped": skipped}


def _import_images(source_dir: str, location_id: str) -> dict:
    """Copy image files from source to location directory."""
    loc_dir = get_location_dir(location_id)
    copied = 0

    for img_subdir in ["images", "downloaded_images"]:
        source_img_dir = os.path.join(source_dir, img_subdir)
        if not os.path.isdir(source_img_dir):
            continue

        dest_img_dir = os.path.join(loc_dir, img_subdir)
        os.makedirs(dest_img_dir, exist_ok=True)

        for fname in os.listdir(source_img_dir):
            src_path = os.path.join(source_img_dir, fname)
            if not os.path.isfile(src_path):
                continue
            # Validate filename — no path traversal
            if os.sep in fname or fname.startswith("."):
                continue
            dest_path = os.path.join(dest_img_dir, fname)
            if not os.path.exists(dest_path):
                shutil.copy2(src_path, dest_path)
                copied += 1

    return {"images_status": "ok", "copied": copied}


@router.post("/locations/{location_id}/import")
async def import_data(
    location_id: str,
    body: ImportRequest,
    current_user: dict = Depends(get_current_user),
):
    """Import menu data, facts, and images from an external directory.

    The source directory should contain menu.json and/or facts.json,
    with optional images/ and downloaded_images/ subdirectories.
    """
    validate_location_exists(location_id)
    source_dir = _resolve_source_path(body.source_path)

    results = {"location_id": location_id, "source": source_dir}

    if body.import_menu:
        results["menu"] = _import_menu(source_dir, location_id, body.overwrite)

    if body.import_facts:
        results["facts"] = _import_facts(source_dir, location_id, body.overwrite)

    if body.import_images:
        results["images"] = _import_images(source_dir, location_id)

    logger.info("Data imported into location %s from %s: %s", location_id, source_dir, results)
    return results
