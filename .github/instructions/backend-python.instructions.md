---
description: "Use when writing or editing Python backend code. Covers FastAPI patterns, Pydantic models, routers, services, backup/restore, logging, and security for the Menu Editor backend."
applyTo: "backend/**/*.py"
---

# Backend Python Guidelines

## Architecture

- `main.py` — App entry, middleware (CORS, rate limiting), router registration, static file mounts
- `config.py` — Settings from environment variables with defaults (see `docs/02_System_Design.md` §11)
- `database.py` — SQLite setup for admin credentials only (not for menu data)
- `schemas.py` — All Pydantic request/response models
- `routers/` — One file per resource domain (auth, locations, items, facts, upload, deploy, export)
- `services/` — Business logic (backup, image_processor, deployer)

## Patterns

### Router structure
```python
from fastapi import APIRouter, Depends, HTTPException
router = APIRouter(prefix="/api/v1", tags=["items"])

@router.get("/locations/{location_id}/items")
async def list_items(location_id: str, search: str = "", category: str = ""):
    # Validate location_id exists first
    ...
```

### Pydantic models (schemas.py)
Every request body and response MUST have a Pydantic model. No raw dicts.
```python
class MenuItemCreate(BaseModel):
    item_name: str
    price: float = Field(ge=0)
    category: str
    description: str
    # ... all fields from docs/01_System_Requirements.md §2.2
```

### JSON file operations
All data files are location-scoped under `data/locations/{location_id}/`.
Always use the backup service before writes:
```python
from services.backup import create_backup, restore_backup
data_path = f"data/locations/{location_id}/menu.json"
create_backup(data_path)  # creates .bak
try:
    write_json(data_path, data)
except Exception:
    restore_backup(data_path)
    raise
```

### Logging
```python
import logging
logger = logging.getLogger(__name__)
logger.info("Item created: %s", item_id)
# NEVER: print(), logger.info(f"token={token}")
```

### Location ID generation
```python
import re
def generate_location_id(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
```

### Item ID generation
```python
import re
def generate_item_id(item_name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', item_name.lower()).strip('-')
```

### Fact ID generation
```python
import uuid
def generate_fact_id() -> str:
    return str(uuid.uuid4())
```

## Security Rules

- All write endpoints require `Depends(get_current_user)` — JWT validation
- Read-only endpoints (`/api/v1/locations` (without auth), `/api/v1/locations/{loc}/menu`, `.../menu/facts`, `/api/v1/health`, `.../version`) have NO auth
- `GET /api/v1/locations` is dual-purpose: with JWT returns full details; without auth returns slim `[{location_id, name}]`
- Image upload: validate MIME type against allowlist, enforce 10MB limit, sanitize filename (no path traversal)
- Deploy targets: validate paths with `os.path.realpath()` to prevent traversal
- Static file serving: mount `data/locations/` as a single static root at startup
- Login: rate limited via slowapi (5/min default)
- Password auth errors: generic "Invalid credentials" — never reveal which field was wrong

## Data Format

All data files live under `data/locations/{location_id}/`. Location registry in `data/locations.json`.

### locations.json
```json
{
  "locations": [
    {
      "location_id": "garden-grove",
      "name": "Garden Grove",
      "address": "9892 Westminster Ave",
      "created_at": "2026-04-20T10:00:00Z",
      "last_deployed_at": null,
      "deploy_targets": []
    }
  ]
}
```

### menu.json (per location)
```json
{
  "schema_version": "1.0",
  "items": [
    {
      "item_id": "honey-walnut-shrimps",
      "item_name": "Honey Walnut Shrimps",
      "price": 13.00,
      "category": "Seafood",
      ...
    }
  ]
}
```

### facts.json
```json
{
  "schema_version": "1.0",
  "facts": [
    {
      "fact_id": "a1b2c3d4-...",
      "topic": "Restaurant Overview",
      "content": "...",
      "type": "general_info"
    }
  ]
}
```

## Dependencies

See `backend/requirements.txt` for pinned versions. Key packages:
- `fastapi`, `uvicorn[standard]` — API server
- `python-jose[cryptography]` — JWT
- `passlib[bcrypt]` — Password hashing
- `pillow`, `pillow-heif` — Image processing
- `python-multipart` — File uploads
- `slowapi` — Rate limiting
