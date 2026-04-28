# GAC Menu Editor — Project Guidelines

## Project Overview

Standalone menu management app for Garlic & Chives restaurant. Two components:
- **Backend**: Python FastAPI on port 8100 (`backend/`)
- **Mobile**: React Native + Expo SDK 54, JavaScript (`mobile/`)

The editor is the **authoritative source** for `menu.json`, `facts.json`, and food images across multiple restaurant locations. Consumer applications (e.g., GAC-Concierge) read from this data via read-only API or deploy mechanism.

## Architecture Rules

- The backend and mobile app are **independent codebases** — no shared code or imports between them.
- All data mutations go through the backend API. The mobile app is a thin client.
- The system supports **multiple locations** — each location has its own menu, facts, and images stored under `data/locations/{location_id}/`.
- Locations are registered in `data/locations.json`. All item/fact/image endpoints are scoped by `location_id`.
- Items are identified by `item_id` (immutable slug). Facts are identified by `fact_id` (UUID). Locations by `location_id` (slug).
- Both `menu.json` and `facts.json` include a `schema_version` field (current: `"1.0"`).
- Read-only endpoints (`/api/v1/locations/{loc_id}/menu`, `.../menu/facts`) require **no authentication**. All write endpoints require JWT.
- Edits are staged per-location; "Deploy" pushes data to consumer targets configured per-location.

## Documentation

Read these docs before implementing features — they are the source of truth:

- `docs/01_System_Requirements.md` — EARS notation requirements with IDs (FR-M01, NFR-S01, etc.)
- `docs/02_System_Design.md` — Architecture, API contracts, screen mockups, data flows
- `docs/03_Branding_Guidelines.md` — Color palette, typography, component styling
- `docs/04_Review_Notes.md` — Review findings and traceability matrix

When implementing a feature, **cite the requirement ID** (e.g., "Implements FR-M01") in commit messages and code comments for traceability.

## Build and Test

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8100 --reload
pytest ../tests/backend/ -v
```

### Mobile
```bash
cd mobile
npm install
npx expo start
npm test
```

### Service Script
```bash
./scripts/editor_service.sh start | stop | restart | status
```

## Code Conventions

### Python (backend/)
- Python 3.10+, FastAPI with Pydantic models for all request/response validation
- Routers in `routers/`, business logic in `services/`
- All write operations: create `.bak` backup before modifying JSON files
- Use `logging` module — never `print()` for diagnostics
- Security: validate all inputs server-side even if client validates too

### JavaScript (mobile/)
- React Native with Expo SDK 54, plain JavaScript (no TypeScript)
- State lives in `App.js` — no external state management library
- API calls centralized in `services/api.js`
- Components are functional with hooks — no class components
- Touch targets minimum 44px per platform HIG

## File Naming

- Backend: `snake_case.py`
- Mobile components/screens: `PascalCase.js`
- Mobile services: `camelCase.js`
- Tests: `test_*.py` (backend), `*.test.js` (mobile)

## Security Checklist

- Never log passwords or JWT tokens
- Validate file types and enforce 10MB size limit on image uploads
- Prevent path traversal in image filenames and deploy target paths
- Use bcrypt for password hashing, never plaintext
- Rate limit login endpoint (5 attempts/minute)
