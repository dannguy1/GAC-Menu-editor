"""Facts router (location-scoped).

Implements FR-F01-F07 - full CRUD for restaurant facts.
"""
import json
import logging
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from config import settings
from routers.auth import get_current_user
from routers.locations import validate_location_exists, get_location_dir
from schemas import FactCreate, FactUpdate
from services.backup import create_backup, restore_backup

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["facts"])


def get_facts_path(location_id: str) -> str:
    return os.path.join(get_location_dir(location_id), "facts.json")


def read_facts(location_id: str) -> dict:
    path = get_facts_path(location_id)
    if not os.path.exists(path):
        return {"schema_version": "1.0", "facts": []}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_facts(location_id: str, data: dict) -> None:
    path = get_facts_path(location_id)
    create_backup(path)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception:
        restore_backup(path)
        raise


@router.get("/locations/{location_id}/facts")
async def list_facts(location_id: str, current_user: dict = Depends(get_current_user)):
    """List all facts for a location. Implements FR-F01."""
    validate_location_exists(location_id)
    data = read_facts(location_id)
    facts = data.get("facts", [])
    return {"facts": facts, "total": len(facts)}


@router.post("/locations/{location_id}/facts")
async def create_fact(
    location_id: str,
    body: FactCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a fact with auto-generated UUID. Implements FR-F03, FR-F04, FR-F05."""
    validate_location_exists(location_id)
    fact_id = str(uuid.uuid4())
    new_fact = {
        "fact_id": fact_id,
        "topic": body.topic,
        "content": body.content,
        "type": body.type,
    }
    data = read_facts(location_id)
    data.setdefault("facts", []).append(new_fact)
    write_facts(location_id, data)
    logger.info("Fact created: %s in location: %s", fact_id, location_id)
    return {"fact": new_fact, "message": "Fact created"}


@router.put("/locations/{location_id}/facts/{fact_id}")
async def update_fact(
    location_id: str,
    fact_id: str,
    body: FactUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a fact. Implements FR-F02, FR-F05."""
    validate_location_exists(location_id)
    data = read_facts(location_id)
    facts = data.get("facts", [])

    for i, fact in enumerate(facts):
        if fact["fact_id"] == fact_id:
            update_data = body.model_dump(exclude_unset=True)
            facts[i].update(update_data)
            write_facts(location_id, data)
            logger.info("Fact updated: %s in location: %s", fact_id, location_id)
            return {"fact": facts[i], "message": "Fact updated"}

    raise HTTPException(status_code=404, detail=f"Fact '{fact_id}' not found")


@router.delete("/locations/{location_id}/facts/{fact_id}")
async def delete_fact(
    location_id: str,
    fact_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a fact. Implements FR-F06."""
    validate_location_exists(location_id)
    data = read_facts(location_id)
    facts = data.get("facts", [])
    original_count = len(facts)
    data["facts"] = [f for f in facts if f["fact_id"] != fact_id]

    if len(data["facts"]) == original_count:
        raise HTTPException(status_code=404, detail=f"Fact '{fact_id}' not found")

    write_facts(location_id, data)
    logger.info("Fact deleted: %s from location: %s", fact_id, location_id)
    return {"message": "Fact deleted"}
