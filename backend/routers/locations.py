"""Location management router.

Implements FR-L01-L10, FR-P03a - location CRUD with dual-purpose GET.
"""
import json
import logging
import os
import re
import shutil
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import settings
from routers.auth import get_current_user, _optional_current_user
from schemas import LocationCreate, LocationUpdate, LocationResponse, LocationSlim
from services.backup import create_backup, restore_backup

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["locations"])
security = HTTPBearer(auto_error=False)


def get_locations_file() -> str:
    return settings.LOCATIONS_FILE


def read_locations() -> dict:
    path = get_locations_file()
    if not os.path.exists(path):
        return {"locations": []}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_locations(data: dict) -> None:
    path = get_locations_file()
    create_backup(path)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception:
        restore_backup(path)
        raise


def get_location_by_id(location_id: str) -> Optional[dict]:
    data = read_locations()
    for loc in data["locations"]:
        if loc["location_id"] == location_id:
            return loc
    return None


def validate_location_exists(location_id: str) -> dict:
    loc = get_location_by_id(location_id)
    if not loc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Location '{location_id}' not found",
        )
    return loc


def get_location_dir(location_id: str) -> str:
    return os.path.join(settings.DATA_DIR, "locations", location_id)


def generate_location_id(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _count_items(location_id: str) -> int:
    menu_path = os.path.join(get_location_dir(location_id), "menu.json")
    if not os.path.exists(menu_path):
        return 0
    with open(menu_path) as f:
        data = json.load(f)
    return len(data.get("items", []))


def _count_facts(location_id: str) -> int:
    facts_path = os.path.join(get_location_dir(location_id), "facts.json")
    if not os.path.exists(facts_path):
        return 0
    with open(facts_path) as f:
        data = json.load(f)
    return len(data.get("facts", []))


def _init_location_dir(location_id: str) -> None:
    loc_dir = get_location_dir(location_id)
    os.makedirs(loc_dir, exist_ok=True)
    for subdir in ["images", "downloaded_images", "uploaded_images"]:
        os.makedirs(os.path.join(loc_dir, subdir), exist_ok=True)

    menu_path = os.path.join(loc_dir, "menu.json")
    if not os.path.exists(menu_path):
        with open(menu_path, "w") as f:
            json.dump({"schema_version": "1.0", "items": []}, f, indent=2)

    facts_path = os.path.join(loc_dir, "facts.json")
    if not os.path.exists(facts_path):
        with open(facts_path, "w") as f:
            json.dump({"schema_version": "1.0", "facts": []}, f, indent=2)


@router.get("/locations")
async def list_locations(current_user: Optional[dict] = Depends(_optional_current_user)):
    """Dual-purpose endpoint: with JWT returns full details, without auth returns slim list.

    Implements FR-L10, FR-P03a.
    """
    data = read_locations()
    locations = data.get("locations", [])

    if current_user:
        result = []
        for loc in locations:
            result.append(LocationResponse(
                location_id=loc["location_id"],
                name=loc["name"],
                address=loc.get("address"),
                created_at=loc["created_at"],
                last_deployed_at=loc.get("last_deployed_at"),
                item_count=_count_items(loc["location_id"]),
                fact_count=_count_facts(loc["location_id"]),
            ))
        return {"locations": [r.model_dump() for r in result]}
    else:
        slim = [LocationSlim(location_id=loc["location_id"], name=loc["name"]) for loc in locations]
        return {"locations": [s.model_dump() for s in slim]}


@router.post("/locations")
async def create_location(body: LocationCreate, current_user: dict = Depends(get_current_user)):
    """Create a new location. Implements FR-L01, FR-L06."""
    location_id = generate_location_id(body.name)
    if not location_id:
        raise HTTPException(status_code=400, detail="Invalid location name")

    data = read_locations()
    for loc in data["locations"]:
        if loc["location_id"] == location_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Location '{location_id}' already exists",
            )
        if loc["name"].lower() == body.name.strip().lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A location named '{body.name}' already exists",
            )

    now = datetime.now(timezone.utc).isoformat()
    new_loc = {
        "location_id": location_id,
        "name": body.name.strip(),
        "address": body.address,
        "created_at": now,
        "last_deployed_at": None,
        "deploy_targets": [],
    }
    data["locations"].append(new_loc)
    write_locations(data)
    _init_location_dir(location_id)
    logger.info("Location created: %s", location_id)

    return {
        "location": LocationResponse(
            location_id=location_id,
            name=new_loc["name"],
            address=new_loc.get("address"),
            created_at=now,
            last_deployed_at=None,
            item_count=0,
            fact_count=0,
        ).model_dump(),
        "message": "Location created",
    }


@router.put("/locations/{location_id}")
async def update_location(
    location_id: str,
    body: LocationUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update location name/address. Implements FR-L07."""
    data = read_locations()
    for i, loc in enumerate(data["locations"]):
        if loc["location_id"] == location_id:
            if body.name is not None:
                # Check for duplicate name (same check as POST)
                new_name = body.name.strip()
                for other in data["locations"]:
                    if other["location_id"] != location_id and other["name"].lower() == new_name.lower():
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail=f"A location named '{new_name}' already exists",
                        )
                data["locations"][i]["name"] = new_name
            if body.address is not None:
                data["locations"][i]["address"] = body.address
            write_locations(data)
            logger.info("Location updated: %s", location_id)
            updated = data["locations"][i]
            return {
                "location": LocationResponse(
                    location_id=updated["location_id"],
                    name=updated["name"],
                    address=updated.get("address"),
                    created_at=updated["created_at"],
                    last_deployed_at=updated.get("last_deployed_at"),
                    item_count=_count_items(location_id),
                    fact_count=_count_facts(location_id),
                ).model_dump(),
                "message": "Location updated",
            }
    raise HTTPException(status_code=404, detail=f"Location '{location_id}' not found")


@router.delete("/locations/{location_id}")
async def delete_location(location_id: str, current_user: dict = Depends(get_current_user)):
    """Delete location and all its data. Implements FR-L01."""
    data = read_locations()
    original_count = len(data["locations"])
    data["locations"] = [loc for loc in data["locations"] if loc["location_id"] != location_id]

    if len(data["locations"]) == original_count:
        raise HTTPException(status_code=404, detail=f"Location '{location_id}' not found")

    write_locations(data)

    loc_dir = get_location_dir(location_id)
    if os.path.exists(loc_dir):
        shutil.rmtree(loc_dir)

    logger.info("Location deleted: %s", location_id)
    return {"message": "Location deleted"}
