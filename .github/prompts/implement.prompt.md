---
description: "Execute the GAC Menu Editor implementation plan task-by-task. Run with a task number or range to build backend and mobile features per the spec."
agent: "agent"
argument-hint: "Task number or range (e.g., '1.1' or '1.1-1.5')"
---

# GAC Menu Editor — Implementation Agent

You are implementing the GAC Menu Editor: a standalone menu management system for the Garlic & Chives restaurant chain. Two independent codebases — a Python FastAPI backend and a React Native (Expo SDK 54, JavaScript) mobile app.

## Your Mandate

Execute tasks from the implementation plan ([tasks.md](../../tasks.md)). Each task has files to create, a description, acceptance criteria, and requirement refs. Work through them sequentially unless a specific task or range is given.

## Before You Start

Read these files to understand the full system. Do not begin coding until you have read at least the first four:

1. [tasks.md](../../tasks.md) — The implementation plan. Your task list.
2. [docs/02_System_Design.md](../../docs/02_System_Design.md) — Architecture, API contracts, screen mockups, data flows. **This is the primary reference for how everything works.**
3. [docs/01_System_Requirements.md](../../docs/01_System_Requirements.md) — EARS-notation requirements with IDs (FR-M01, NFR-S01, etc.)
4. [docs/03_Branding_Guidelines.md](../../docs/03_Branding_Guidelines.md) — Color palette, typography, component styling (needed for mobile UI tasks)

These instruction files are auto-loaded by file pattern but you should be aware of them:
- `.github/copilot-instructions.md` — Project-wide conventions
- `.github/instructions/backend-python.instructions.md` — FastAPI patterns, Pydantic, services
- `.github/instructions/mobile-react-native.instructions.md` — Component patterns, state, navigation
- `.github/instructions/api-design.instructions.md` — Endpoint table, error codes, key rules
- `.github/instructions/testing.instructions.md` — pytest fixtures, Jest patterns

## Execution Protocol

For each task:

1. **Read** the task description and referenced docs/sections
2. **Create or edit** the files listed in the task
3. **Verify** by running the acceptance check:
   - Backend tasks: `cd backend && python -c "from <module> import *; print('OK')"` or `pytest ../tests/backend/<file> -v` as appropriate
   - Mobile tasks: syntax-check with `cd mobile && npx react-native-community/cli doctor` or ensure no import errors
4. **Report** what was done and confirm acceptance criteria met before moving to the next task

## Critical Design Decisions

These are non-obvious decisions baked into the design. Violating any of these will create bugs:

### Backend

- **`GET /api/v1/locations` is dual-purpose.** With a JWT `Authorization` header, return full details (name, address, item_count, fact_count, last_deployed_at). Without auth, return only `[{location_id, name}]`. This is ONE endpoint with optional auth — not two separate endpoints.

- **Image cleanup happens in PUT items and DELETE items, NOT in upload.** The upload endpoint (`POST .../upload`) only saves the new file and returns the path. When `PUT .../items/{item_id}` receives a different `image_path` than what's stored, the backend deletes the old image file. When `DELETE .../items/{item_id}` runs, the backend deletes the item's image file. The upload endpoint has no knowledge of existing items.

- **Single static file mount at startup.** Mount `data/locations/` once in `main.py` (e.g., `app.mount("/locations", StaticFiles(directory="data/locations"))`). This serves images for ALL locations, including ones created after startup, without restart. Do NOT mount per-location directories.

- **Token validation uses `GET /api/v1/locations`.** The mobile app validates a saved JWT by calling `GET /api/v1/locations` with the token. A 200 means valid; a 401 means expired. Do NOT use `/api/v1/health` (which requires no auth and can't validate tokens).

- **Deploy targets are file-managed.** `deploy_targets` live in `data/locations.json` per-location. They are edited manually on the server. There is no API endpoint to manage deploy targets and no UI in the mobile app to configure them.

- **CORS is always `*`.** This is a LAN-only app. No origin restrictions.

- **No TLS configuration.** No HTTPS, no SSL certificates, no TLS env vars.

- **Rate limiting is optional.** FR-A08 is Could priority. If you implement slowapi on login, keep it simple. Don't block the task on getting rate limiting perfect.

- **Export endpoint requires JWT.** Unlike the read-only consumer endpoints (`/menu`, `/menu/facts`, `/version`), the export ZIP endpoint (`GET .../export`) is JWT-protected because it's triggered from the authenticated Settings screen.

### Mobile

- **All state in App.js.** No Redux, Context, or external state management. Pass state and callbacks as props. State shape is defined in `docs/02_System_Design.md` §2.2.

- **Navigation via conditional rendering, not React Navigation.** `if (!isAuthenticated) return <LoginScreen />; if (!activeLocation) return <LocationPickerScreen />; ...` with tab state for Menu/Facts/Settings.

- **Token validation on launch.** On app start, check SecureStore for a saved token. If found, call `GET /api/v1/locations` with it. 200 → go to location picker. 401 → clear token and show login.

- **Location picker is the second gate.** After login, user MUST select a location before seeing menu/facts/settings tabs.

- **`expo-secure-store` for JWT, `AsyncStorage` for server host and last location.** Never store tokens in AsyncStorage.

## File Naming Conventions

| Scope | Convention | Example |
|-------|-----------|---------|
| Backend Python | `snake_case.py` | `image_processor.py` |
| Mobile screens | `PascalCase.js` | `MenuListScreen.js` |
| Mobile components | `PascalCase.js` | `MenuItemCard.js` |
| Mobile services | `camelCase.js` | `imageHelper.js` |
| Backend tests | `test_*.py` | `test_items.py` |
| Mobile tests | `*.test.js` | `api.test.js` |

## Code Quality Rules

- **Python**: Use `logging` module, never `print()`. All request/response bodies use Pydantic models. All JSON writes use backup service. Validate `location_id` exists on every location-scoped endpoint.
- **JavaScript**: Functional components with hooks only. `StyleSheet.create()` at bottom of files. 44px minimum touch targets. `KeyboardAvoidingView` on forms.
- **Both**: Never log passwords or tokens. Validate all inputs server-side even if client validates.

## Build and Run Commands

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8100 --reload
pytest ../tests/backend/ -v

# Mobile
cd mobile
npm install
npx expo start
npm test
```

## Task Argument

The user will specify which task(s) to implement: `{{input}}`. If empty, start with the next not-started task in tasks.md.
