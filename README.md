# GAC Menu Editor

Standalone menu management app for **Garlic & Chives** restaurant. Built with Expo Go (React Native) for Android and iOS, with its own FastAPI backend.

## Purpose

The authoritative tool for managing the restaurant's menu database:

- **menu.json** — Add, edit, and delete menu items with bilingual descriptions
- **facts.json** — Manage restaurant information and announcements
- **Images** — Capture food photos directly from mobile devices

Consumer applications (e.g., GAC-Concierge) obtain data from this editor via read-only API, export packages, or the publish mechanism. The editor has no runtime dependency on any consumer.

## Documentation

| Document | Description |
|----------|-------------|
| [System Requirements](docs/01_System_Requirements.md) | Functional and non-functional requirements in EARS notation |
| [System Design](docs/02_System_Design.md) | Architecture, screen designs, API design, data flows, publish mechanism |
| [Branding Guidelines](docs/03_Branding_Guidelines.md) | Color palette, typography, component styling for the GAC product family |
| [Review Notes](docs/04_Review_Notes.md) | Documentation review findings, gap analysis, and implementation recommendations |
| [Implementation Tasks](tasks.md) | Phased task plan for coding agent execution |

## Architecture

```
┌─────────────────────┐
│  Mobile App         │
│  (Expo Go)          │──HTTP LAN──►  Menu Editor Backend (:8100)
│  Android / iOS      │                     │
└─────────────────────┘                     ▼
                                      data/menu.json
                                      data/facts.json
                                      data/uploaded_images/
                                            │
                              ┌─────────────┼──────────────┐
                              ▼             ▼              ▼
                        GAC-Concierge   Future App    Website/CMS
                        (consumer)      (consumer)    (consumer)
```

- **Own backend** — FastAPI on port 8100, independent of any consumer application
- **Read-only API** — Unauthenticated endpoints for consumers to pull menu/facts data
- **Publish mechanism** — Push data to configured consumer targets (file copy or HTTP)
- **JWT authentication** — All write operations require authentication
- **Server-side image processing** — Resize and WebP conversion

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo SDK 54, JavaScript |
| Backend | Python, FastAPI, Pillow, SQLite |
| Distribution | Expo Go (dev), EAS Build (production) |

## Data Flow

```
Editor (create/edit) → Menu Editor Backend → data/*.json
                                                  │
                            ┌─────────────────────┤
                            ▼                     ▼
                    Publish (push)         Read-Only API (pull)
                    to consumer dirs       GET /api/v1/menu
                                           GET /api/v1/menu/facts
```

## Related Projects

- [GAC-Concierge](../GAC-Concierge) — AI-powered restaurant concierge (a consumer of menu data)
- [GAC_Menu_Admin](../GAC_Menu_Admin) — Original PoC web-based menu admin (predecessor)

## Status

**Scaffolded** — Project structure, agent instructions, and implementation task plan are ready. Implementation not yet started.
