---
description: "Use when implementing or modifying API endpoints, request/response schemas, or error handling. Covers all Menu Editor API contracts, authentication, and consumer-facing read-only endpoints."
applyTo: "backend/routers/**/*.py"
---

# API Design Reference

All endpoints served by FastAPI on port 8100. Full contract in `docs/02_System_Design.md` §4.

## Endpoint Summary

### Admin (JWT required)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/auth/token` | Login → returns JWT + `password_is_default` flag |
| PUT | `/api/v1/auth/password` | Change password |
| GET | `/api/v1/locations` | List all locations with counts |
| POST | `/api/v1/locations` | Create location (generates `location_id` slug) |
| PUT | `/api/v1/locations/{location_id}` | Update location name/address |
| DELETE | `/api/v1/locations/{location_id}` | Delete location + all data |
| GET | `/api/v1/locations/{loc}/items?search=&category=` | List/search items |
| POST | `/api/v1/locations/{loc}/items` | Create item (generates `item_id`) |
| PUT | `/api/v1/locations/{loc}/items/{item_id}` | Update item |
| DELETE | `/api/v1/locations/{loc}/items/{item_id}` | Delete item + cleanup image |
| GET | `/api/v1/locations/{loc}/items/categories` | List categories |
| GET | `/api/v1/locations/{loc}/facts` | List facts |
| POST | `/api/v1/locations/{loc}/facts` | Create fact (generates `fact_id` UUID) |
| PUT | `/api/v1/locations/{loc}/facts/{fact_id}` | Update fact |
| DELETE | `/api/v1/locations/{loc}/facts/{fact_id}` | Delete fact |
| POST | `/api/v1/locations/{loc}/upload` | Upload + process image |
| POST | `/api/v1/locations/{loc}/deploy` | Push to consumer targets |
| GET | `/api/v1/locations/{loc}/export` | Download ZIP package |

### Read-Only (no auth)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/locations` | Public: slim list of `{location_id, name}` for consumer discovery |
| GET | `/api/v1/locations/{loc}/menu` | Full menu with `schema_version` |
| GET | `/api/v1/locations/{loc}/menu/facts` | Full facts with `schema_version` |
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/locations/{loc}/version` | Data hashes for change detection |

**Note**: `GET /api/v1/locations` is dual-purpose. With JWT it returns full details (counts, deploy status). Without auth it returns only `location_id` + `name`.

## Error Response Format
```json
{ "detail": "Human-readable message", "code": "ERROR_CODE" }
```
Codes: `VALIDATION_ERROR`, `NOT_FOUND`, `DUPLICATE_ITEM`, `LOCATION_NOT_FOUND`, `AUTH_FAILED`, `TOKEN_EXPIRED`, `RATE_LIMITED`, `SERVER_ERROR`, `DEPLOY_FAILED`

## Key Rules
- All item/fact/image endpoints are scoped by `location_id`. Validate location exists before processing.
- `location_id` = slugified location `name`, immutable after creation.
- `item_id` = slugified `item_name`, immutable after creation. Renaming updates `item_name` only.
- `fact_id` = UUID, auto-generated on `POST .../facts`.
- Image cleanup on PUT: if `image_path` changed, delete the old image file from the location's `uploaded_images/`.
- Image delete on item delete: if `image_path` exists, remove the file from the location's `uploaded_images/`.
- Image replace: the upload endpoint does NOT delete old images. Cleanup is handled by the PUT item endpoint.
- All write endpoints create `.bak` backup before modifying JSON files.
- Deploy targets are per-location, stored in `data/locations.json`. Managed by editing the file on the server, not via API.
- Static files: mount `data/locations/` as a single root at startup so dynamically-created location images are served automatically.
