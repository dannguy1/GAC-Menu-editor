"""Deploy router (location-scoped).

Implements FR-P04-P06, FR-L08 - deploy location data to consumer targets.
"""
import json
import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from config import settings
from routers.auth import get_current_user
from routers.locations import validate_location_exists, get_location_dir, read_locations, write_locations
from schemas import DeployRequest, DeployResult, DeployTargetResult
from services.deployer import deploy_location

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["deploy"])


@router.post("/locations/{location_id}/deploy")
async def deploy(
    location_id: str,
    body: DeployRequest = None,
    current_user: dict = Depends(get_current_user),
):
    """Deploy location data to all configured targets. Implements FR-P04, FR-L08."""
    location = validate_location_exists(location_id)
    loc_dir = get_location_dir(location_id)

    # Filter deploy targets if specific ones requested
    if body and body.targets and body.targets != ["all"]:
        location = dict(location)  # copy to avoid mutating cached data
        location["deploy_targets"] = [
            t for t in location.get("deploy_targets", [])
            if t.get("name") in body.targets
        ]

    results = deploy_location(location, loc_dir)

    # Update last_deployed_at for this location
    now = datetime.now(timezone.utc).isoformat()
    data = read_locations()
    for i, loc in enumerate(data["locations"]):
        if loc["location_id"] == location_id:
            data["locations"][i]["last_deployed_at"] = now
            break
    write_locations(data)

    logger.info("Deploy completed for location: %s, results: %s", location_id, results)
    return DeployResult(
        results=[DeployTargetResult(**r) for r in results]
    ).model_dump()
