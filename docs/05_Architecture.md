# Architecture Document

## 1. Executive Summary

GAC Menu Editor is a self-contained, two-component system for managing the Garlic & Chives restaurant menu database across multiple locations. It serves as the **single source of truth** for menu items, restaurant facts, and food images. Consumer applications (e.g., GAC-Concierge AI waiter) obtain data from the editor but are not required for it to function.

| Attribute | Value |
|-----------|-------|
| **Product** | GAC Menu Editor |
| **Version** | 1.0.0 |
| **Backend** | Python 3.12 / FastAPI on port 8100 |
| **Mobile** | React Native 0.81 / Expo SDK 54 (JavaScript) |
| **Auth** | JWT (HS256, 8-hour expiry) + bcrypt password hashing |
| **Data store** | JSON files (menu, facts) + SQLite (admin credentials) |
| **Deployment** | LAN-only; backend on Ubuntu server, mobile via Expo Go |
| **License** | Private / Internal |

---

## 2. System Context

```
                         ┌─────────────────────────────────┐
                         │        GAC Ecosystem             │
                         │                                  │
  ┌──────────────┐       │  ┌────────────────────────────┐  │
  │  Restaurant  │       │  │    GAC Menu Editor          │  │
  │  Staff       │───────┼──│    (this system)            │  │
  │  (iPad/Phone)│  LAN  │  │    :8100                    │  │
  └──────────────┘       │  └─────────┬──────────────────┘  │
                         │            │                     │
                         │   Read-Only API / Deploy / Export│
                         │            │                     │
                         │  ┌─────────▼──────────────────┐  │
                         │  │  Consumer Applications      │  │
                         │  │  • GAC-Concierge   (:8000)  │  │
                         │  │  • GAC-Display     (:8600)  │  │
                         │  │  • GAC-Cocktails   (:8510)  │  │
                         │  │  • Future apps              │  │
                         │  └────────────────────────────┘  │
                         └─────────────────────────────────┘
```

### 2.1 GAC Port Allocation

| Port | Application |
|------|-------------|
| 8000 | GAC-Concierge API |
| 8100 | **GAC Menu Editor** (this system) |
| 8501 | GAC-Concierge Streamlit |
| 8503 | GAC-Display shell |
| 8504 | GAC-Display session menu |
| 8510 | GAC-Cocktails |
| 8600 | GAC-Display backend |

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Mobile App (Expo Go)                       │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Android     │  │  iOS (iPad)  │  │  Expo Go / EAS Build   │ │
│  │  Phone       │  │  iPhone      │  │  APK / TestFlight      │ │
│  └──────┬───────┘  └──────┬───────┘  └────────────────────────┘ │
└─────────┼──────────────────┼────────────────────────────────────┘
          │  HTTP (LAN)      │  HTTP (LAN)
          ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              Menu Editor Backend (FastAPI :8100)                  │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌───────────┐ │
│  │  Auth    │ │ Locations│ │  Items │ │  Facts │ │  Upload   │ │
│  │  Router  │ │  Router  │ │ Router │ │ Router │ │  Router   │ │
│  └──────────┘ └──────────┘ └────────┘ └────────┘ └───────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────────────────┐   │
│  │  Deploy  │ │  Export  │ │ Import │ │  Clear Location    │   │
│  │  Router  │ │  Router  │ │ Router │ │  Router            │   │
│  └──────────┘ └──────────┘ └────────┘ └────────────────────┘   │
│                                                                  │
│  ┌─────────────────────── Services ───────────────────────────┐ │
│  │  backup.py  │  image_processor.py  │  deployer.py          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────── Data Layer ─────────────────────────┐ │
│  │  SQLite (admin.db)  │  JSON files  │  Static image files   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │
          │  Publish / Read-Only API / Export ZIP
          ▼
┌─────────────────────────────────────────────────────────────────┐
│              Consumer Applications (independent)                 │
│  Pull via GET /api/v1/locations/{id}/menu                        │
│  Receive push via deploy file-copy or HTTP POST                  │
│  Poll via GET /api/v1/locations/{id}/version                     │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1 Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Standalone backend on port 8100 | Independence from consumers; editor is the authoritative data source |
| JSON file storage (not SQL) | Menu data is the public contract (`menu.json`, `facts.json`); direct file output eliminates ETL |
| SQLite for credentials only | Admin user management is relational but tiny; no ORM needed |
| Separate read-only and admin APIs | Consumers access data without auth; edits require JWT |
| Expo SDK 54 / JavaScript | Consistent with other GAC mobile apps; no TypeScript for lower friction |
| All state in App.js | Small app; no Redux/MobX overhead; single source of truth |
| Single-editor assumption | LAN-only, single user at a time; no conflict resolution |
| No pagination | Dataset is small (~160 items, ~10 facts); revisit if >500 items |
| Multi-location isolation | Each location has fully independent data; no cross-references |

---

## 4. Component Architecture

### 4.1 Backend Components

```
backend/
├── main.py                  FastAPI app factory, middleware, router registration
├── config.py                Environment-driven settings (Settings class)
├── database.py              SQLite admin user CRUD + bcrypt hashing
├── schemas.py               All Pydantic request/response models
├── routers/
│   ├── auth.py              POST /auth/token, PUT /auth/password
│   ├── locations.py         Location CRUD, dual-purpose GET (auth/public)
│   ├── items.py             Menu item CRUD (location-scoped)
│   ├── facts.py             Facts CRUD (location-scoped)
│   ├── upload.py            Image upload + server-side processing
│   ├── deploy.py            Push data to consumer targets
│   ├── export.py            ZIP export + read-only consumer endpoints
│   ├── import_data.py       Bulk import from external data directories
│   └── clear_location.py    Reset location data (admin/testing utility)
└── services/
    ├── backup.py            JSON file backup/restore before writes
    ├── image_processor.py   Resize → 800px max, convert → WebP 85%
    └── deployer.py          File-copy and HTTP-POST deploy strategies
```

#### Router Responsibilities

| Router | Endpoints | Auth | Purpose |
|--------|-----------|------|---------|
| `auth` | `POST /auth/token`, `PUT /auth/password` | Public / JWT | Login, password management |
| `locations` | `GET/POST/PUT /locations` | Dual (public slim / JWT full) | Location CRUD |
| `items` | `GET/POST/PUT/DELETE /locations/{id}/items` | JWT | Menu item CRUD |
| `facts` | `GET/POST/PUT/DELETE /locations/{id}/facts` | JWT | Facts CRUD |
| `upload` | `POST /locations/{id}/upload` | JWT | Image upload + processing |
| `deploy` | `POST /locations/{id}/deploy` | JWT | Push to consumer targets |
| `export` | `GET /locations/{id}/export`, `/menu`, `/menu/facts`, `/version` | Mixed | ZIP download + read-only APIs |
| `import_data` | `POST /locations/{id}/import` | JWT | Bulk import from external source |
| `clear_location` | `POST /locations/{id}/clear` | JWT | Reset location data |

#### Service Layer

| Service | Responsibility |
|---------|---------------|
| `backup.py` | Copy `*.json` → `*.json.bak` before every write; restore on failure (NFR-R01–R03) |
| `image_processor.py` | Validate type → resize to 800px max edge → convert to WebP → generate `{Category}_{Name}.webp` filename |
| `deployer.py` | Execute deploy targets: file-copy (with optional `post_command`) or HTTP POST to remote endpoints |

### 4.2 Mobile Components

```
mobile/
├── App.js                   Root: auth gate, location selection, tab navigation, all state
├── screens/
│   ├── LoginScreen.js       Server host config + credential entry
│   ├── LocationPickerScreen.js  Select/create locations
│   ├── MenuListScreen.js    Searchable, filterable menu item list
│   ├── MenuEditScreen.js    Add/edit menu item form with image capture
│   ├── FactsListScreen.js   Searchable facts list
│   ├── FactEditScreen.js    Add/edit fact form
│   └── SettingsScreen.js    Server config, deploy, account, data summary
├── components/
│   ├── MenuItemCard.js      Item card (thumbnail, name, price, badges)
│   ├── FactCard.js          Fact card (topic, type badge, content preview)
│   ├── LocationCard.js      Location card (name, counts, deploy status)
│   ├── PhotoCapture.js      Camera/gallery picker with preview
│   ├── CategoryPicker.js    Horizontal scrolling category tabs
│   ├── SearchBar.js         Debounced search input
│   ├── Toast.js             Success/error toast notifications
│   ├── ConfirmDialog.js     Destructive action confirmation modal
│   └── SettingsModal.js     Server host configuration modal
├── services/
│   ├── api.js               All fetch() calls, host config, timeout handling
│   ├── auth.js              SecureStore (JWT), AsyncStorage (host, last location)
│   └── imageHelper.js       Camera/gallery permission + picker + upload
└── plugins/
    └── withCleartextTraffic.js  Android HTTP cleartext config
```

#### State Architecture

All primary state lives in `App.js` — no external state management library.

| State Variable | Type | Source |
|---------------|------|--------|
| `isAuthenticated` | boolean | Login flow |
| `token` | string | JWT from backend |
| `locations` | array | `GET /locations` |
| `activeLocation` | object \| null | User selection |
| `activeTab` | string | `menu` \| `facts` \| `settings` |
| `menuItems` | array | `GET /locations/{id}/items` |
| `facts` | array | `GET /locations/{id}/facts` |
| `categories` | array | `GET /locations/{id}/items/categories` |
| `editingItem` | object \| null \| undefined | undefined=list, null=new, object=edit |
| `editingFact` | object \| null \| undefined | Same pattern |
| `serverHost` | string | AsyncStorage |
| `isConnected` | boolean | Health check |
| `isOffline` | boolean | Network status |

#### Navigation Flow

```
App Launch → Check SecureStore for token
    │
    ├── No token → LoginScreen
    │                  │
    │                  ▼ (POST /auth/token)
    │
    ├── Token valid → LocationPickerScreen
    │                      │
    │                      ▼ (select location)
    │
    └── Main App (3-tab navigation)
         ├── 🍽 Menu tab
         │    ├── MenuListScreen (search, filter, browse)
         │    └── MenuEditScreen (add/edit item + image capture)
         ├── ℹ️ Facts tab
         │    ├── FactsListScreen (search, browse)
         │    └── FactEditScreen (add/edit fact)
         └── ⚙️ Settings tab
              └── SettingsScreen (server, deploy, account, data)
```

---

## 5. Data Architecture

### 5.1 Storage Overview

```
backend/data/
├── admin.db                     SQLite: admin credentials (bcrypt hashed)
├── .jwt_secret                  Persisted JWT signing key (auto-generated)
├── locations.json               Location registry + deploy target configs
└── locations/
    └── {location_id}/
        ├── menu.json            Menu items (schema_version + items array)
        ├── menu.json.bak        Auto-backup before each write
        ├── facts.json           Facts (schema_version + facts array)
        ├── facts.json.bak       Auto-backup before each write
        ├── images/              Original/imported image assets
        ├── downloaded_images/   Previously-scraped assets (from import)
        └── uploaded_images/     Editor-uploaded images (WebP, processed)
```

### 5.2 Data Schemas

#### menu.json

```json
{
  "schema_version": "1.0",
  "items": [
    {
      "item_id": "honey-walnut-shrimps",
      "item_name": "Honey Walnut Shrimps",
      "item_viet": "Tôm Walnut Mật Ong",
      "pronunciation": "Tom Walnut Mat Ong",
      "description": "Crispy shrimp tossed in honey walnut sauce...",
      "description_viet": "Tôm chiên giòn trộn sốt walnut mật ong...",
      "price": 13.00,
      "category": "Seafood",
      "popular": true,
      "available": true,
      "image_path": "./uploaded_images/Seafood_Honey_Walnut_Shrimps.webp"
    }
  ]
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `item_id` | string | Yes | Auto-generated slug from `item_name`; immutable after creation |
| `item_name` | string | Yes | 1–200 chars |
| `item_viet` | string | No | Vietnamese dish name |
| `pronunciation` | string | No | Phonetic guide |
| `description` | string | Yes | Min 1 char |
| `description_viet` | string | No | Vietnamese description |
| `price` | number | Yes | >= 0 |
| `category` | string | Yes | 1–100 chars |
| `popular` | boolean | No | Default: false |
| `available` | boolean | No | Default: true |
| `image_path` | string | No | Relative path to image file |

#### facts.json

```json
{
  "schema_version": "1.0",
  "facts": [
    {
      "fact_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "topic": "Restaurant Overview",
      "content": "Garlic & Chives, nestled in Garden Grove...",
      "type": "general_info"
    }
  ]
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `fact_id` | string | Yes | Auto-generated UUID |
| `topic` | string | Yes | 1–200 chars |
| `content` | string | Yes | Min 1 char |
| `type` | string | No | One of: `general_info`, `promotion`, `announcement`, `hours`, `policy` |

#### locations.json

```json
{
  "locations": [
    {
      "location_id": "garden-grove",
      "name": "Garden Grove",
      "address": "9892 Westminster Ave, Garden Grove, CA 92844",
      "created_at": "2026-04-20T10:00:00Z",
      "last_deployed_at": "2026-04-27T14:30:00Z",
      "deploy_targets": [
        {
          "name": "GAC-Concierge",
          "type": "file_copy",
          "path": "/home/user/GAC/GAC-Concierge/data",
          "include_images": true,
          "post_command": null
        }
      ]
    }
  ]
}
```

#### admin.db (SQLite)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key, autoincrement |
| `username` | TEXT | Unique, not null |
| `hashed_password` | TEXT | bcrypt hash, not null |
| `password_is_default` | INTEGER | 1 = default password, 0 = changed |

### 5.3 Schema Versioning

Both `menu.json` and `facts.json` include a `schema_version` field (current: `"1.0"`). Schema changes must be backward-compatible and version-incremented. Consumer applications should tolerate unknown fields gracefully.

### 5.4 Backup Strategy

| Mechanism | Behavior |
|-----------|----------|
| Pre-write backup | `menu.json` → `menu.json.bak` before every write |
| Auto-restore | On write failure, `*.bak` → `*` automatically |
| Clear location | Creates `.bak` backup before clearing data |
| Limitation | Single `.bak` file — overwritten on each save |

---

## 6. API Architecture

All endpoints served at `http://{host}:8100/api/v1/`.

### 6.1 Authentication Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/token` | Public | Login → JWT + `password_is_default` flag |
| PUT | `/auth/password` | JWT | Change password (requires current password) |

### 6.2 Admin Endpoints (JWT Required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/locations` | List all locations (full details with counts) |
| POST | `/locations` | Create location (auto-generates `location_id` slug) |
| PUT | `/locations/{id}` | Update location name/address |
| GET | `/locations/{id}/items` | List menu items (supports `?search=` `?category=`) |
| POST | `/locations/{id}/items` | Create menu item |
| PUT | `/locations/{id}/items/{item_id}` | Update menu item |
| DELETE | `/locations/{id}/items/{item_id}` | Delete menu item + cleanup image |
| GET | `/locations/{id}/items/categories` | List distinct categories |
| GET | `/locations/{id}/facts` | List facts |
| POST | `/locations/{id}/facts` | Create fact |
| PUT | `/locations/{id}/facts/{fact_id}` | Update fact |
| DELETE | `/locations/{id}/facts/{fact_id}` | Delete fact |
| POST | `/locations/{id}/upload` | Upload image (multipart/form-data) |
| POST | `/locations/{id}/deploy` | Push data to consumer targets |
| GET | `/locations/{id}/export` | Download ZIP package |
| POST | `/locations/{id}/import` | Bulk import from external directory |
| POST | `/locations/{id}/clear` | Reset location data (requires `confirm: true`) |

### 6.3 Read-Only Endpoints (No Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/locations` | Slim list (location_id + name only) |
| GET | `/locations/{id}/menu` | Full menu with schema_version |
| GET | `/locations/{id}/menu/facts` | Full facts with schema_version |
| GET | `/locations/{id}/version` | Data hashes for change detection |
| GET | `/health` | Health check + version |

### 6.4 Static File Serving

Images served without auth via a single mount point:

```
/locations/{location_id}/images/{filename}
/locations/{location_id}/downloaded_images/{filename}
/locations/{location_id}/uploaded_images/{filename}
```

The `data/locations/` directory is mounted as `StaticFiles` at startup. Dynamically-created locations are automatically served without restart.

### 6.5 Dual-Purpose GET /locations

The `GET /api/v1/locations` endpoint serves two audiences:

| Caller | Auth | Response |
|--------|------|----------|
| Mobile app (admin) | JWT Bearer | Full details: name, address, item_count, fact_count, last_deployed_at |
| Consumer application | None | Slim: location_id, name only |

---

## 7. Security Architecture

### 7.1 Authentication Flow

```
App Launch
    ├── SecureStore has token? → Validate via GET /locations
    │       ├── 200 → LocationPickerScreen
    │       └── 401 → LoginScreen (clear token)
    └── No token → LoginScreen
                      │
                      ▼
              POST /auth/token
                      │
              ├── Success → SecureStore(token)
              │    └── password_is_default? → Change Password prompt
              └── Failure → Error message (no username/password hint)
```

### 7.2 Security Layers

| Layer | Mechanism | Scope |
|-------|-----------|-------|
| Transport | HTTP over LAN (no TLS — trusted network) | All traffic |
| Authentication | JWT Bearer token (HS256) | All write endpoints |
| Token storage | expo-secure-store (Keychain / EncryptedSharedPreferences) | Mobile app |
| Token expiry | 8 hours (configurable) — aligned with shift length | JWT |
| Password hash | bcrypt via passlib | admin.db |
| Rate limiting | slowapi, 5 attempts/minute (optional, disabled in tests) | Login endpoint |
| Input validation | Pydantic schemas (server) + client-side checks | All inputs |
| Path traversal | `os.path.realpath()` validation on file paths | Upload, deploy, import |
| File validation | MIME type check + extension check + 10MB size limit | Image upload |
| CORS | Allow all origins (`*`) — appropriate for LAN | All endpoints |

### 7.3 JWT Configuration

| Parameter | Value | Source |
|-----------|-------|--------|
| Algorithm | HS256 | Hardcoded |
| Secret | 64-char hex | Auto-generated, persisted to `data/.jwt_secret` |
| Expiry | 480 minutes (8 hours) | `JWT_EXPIRE_MINUTES` env var |
| Refresh | None — re-authenticate after expiry | Design decision |

---

## 8. Image Processing Pipeline

```
User captures/selects image
    │
    ▼
Mobile: expo-image-picker (camera or gallery)
    │
    ▼
Mobile: POST /locations/{id}/upload (multipart/form-data)
    │  Fields: file, item_name, category
    ▼
Backend: image_processor.py
    ├── Validate MIME type (JPEG, PNG, WebP, HEIC/HEIF)
    ├── Validate file size (≤ 10MB)
    ├── Open with Pillow (+ pillow-heif for HEIC)
    ├── Convert to RGB
    ├── Resize to max 800px on longest edge (LANCZOS)
    ├── Convert to WebP at 85% quality
    └── Generate filename: {Category}_{Sanitized_Name}.webp
    │
    ▼
Save to data/locations/{id}/uploaded_images/
    │
    ▼
Return { "image_path": "./uploaded_images/{filename}" }
```

**Image lifecycle:**
- **Upload** → processed and saved to `uploaded_images/`
- **Item update** with new `image_path` → old image file deleted
- **Item delete** → associated image file deleted
- **Clear location** → all image directories emptied

---

## 9. Deploy Architecture

### 9.1 Deploy Targets

Each location has independently-configured deploy targets in `locations.json`:

| Target Type | Mechanism | Use Case |
|-------------|-----------|----------|
| `file_copy` | Copy JSON + images to local/network path | GAC-Concierge on same server |
| `http_post` | POST data to remote import API | Remote consumer application |

### 9.2 Deploy Flow

```
Settings → "Deploy Now"
    │
    ▼
POST /api/v1/locations/{id}/deploy
    │
    ▼
Backend reads deploy_targets for location
    │
    ├── file_copy targets:
    │   ├── Validate path (no traversal, not inside data dir)
    │   ├── Copy menu.json, facts.json
    │   ├── Copy image dirs (if include_images: true)
    │   └── Run post_command (if configured)
    │
    └── http_post targets:
        ├── Package menu + facts as JSON
        └── POST to target URL with auth token
    │
    ▼
Update last_deployed_at in locations.json
    │
    ▼
Return per-target results [{target, status, error?}]
```

### 9.3 Consumer Integration Patterns

| Pattern | Mechanism | Consumer Responsibility |
|---------|-----------|------------------------|
| **Pull** | `GET /locations/{id}/menu` (no auth) | Consumer fetches on schedule |
| **Push** | Deploy file-copy or HTTP POST | Consumer receives and processes |
| **Poll** | `GET /locations/{id}/version` (no auth) | Consumer detects hash changes |

---

## 10. CLI Tools

### 10.1 Service Management

```bash
./scripts/editor_service.sh start | stop | restart | status
```

Manages the backend uvicorn process via PID file.

### 10.2 Data Import

```bash
./scripts/import_data.sh <source_path> <location_id>

# Example: import from GAC-Menu legacy data
./scripts/import_data.sh ../GAC-Menu/data garden-grove
```

Bulk imports menu items, facts, and images from an external data directory. Supports the legacy GAC-Menu format (reads both `"info"` and `"facts"` keys). Deduplicates by `item_id` (menu) and `topic` (facts). Generates `item_id` slugs and `fact_id` UUIDs for entries that lack them.

### 10.3 Clear Location Data

```bash
./scripts/clear_location.sh <location_id> [--menu-only | --facts-only | --images-only]

# Examples
./scripts/clear_location.sh garden-grove           # Clear everything
./scripts/clear_location.sh garden-grove --menu-only  # Clear menu only
```

Resets location data for testing or correcting mistakes. Creates backups before clearing. Requires interactive confirmation.

### 10.4 Environment Variables

All scripts support these overrides:

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_URL` | `http://localhost:8100` | Backend API URL |
| `ADMIN_USER` | `admin` | Admin username |
| `ADMIN_PASS` | `changeme123` | Admin password |

---

## 11. Environment Configuration

### 11.1 Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_HOST` | `0.0.0.0` | Server bind address |
| `BACKEND_PORT` | `8100` | Server port |
| `DATA_DIR` | `./data` | Data directory path |
| `LOCATIONS_FILE` | `./data/locations.json` | Location registry path |
| `LOG_DIR` | `./logs` | Log directory |
| `LOG_LEVEL` | `INFO` | Python log level |
| `JWT_SECRET_KEY` | Auto-generated | JWT signing secret (persisted to `data/.jwt_secret`) |
| `JWT_EXPIRE_MINUTES` | `480` | Token expiry (8 hours) |
| `ADMIN_DEFAULT_PASSWORD` | `changeme123` | Initial admin password |
| `LOGIN_RATE_LIMIT` | `5` | Max login attempts per minute |
| `DISABLE_RATE_LIMIT` | (unset) | Set to `1` to disable rate limiting |

### 11.2 Mobile Configuration

| Setting | Location | Description |
|---------|----------|-------------|
| Server host | AsyncStorage (`gac_menu_editor_host`) | Backend URL, configurable from LoginScreen |
| JWT token | SecureStore (`gac_menu_editor_token`) | Encrypted platform storage |
| Last location | AsyncStorage (`gac_menu_editor_last_location`) | Auto-select on next launch |

### 11.3 Expo Configuration

| Setting | Value |
|---------|-------|
| SDK | 54 |
| New Architecture | Enabled (`newArchEnabled: true`) |
| Bundle ID | `com.garlicandchives.menueditor` |
| Camera permission | "GAC Menu Editor needs camera access to photograph dishes for the menu." |
| Photo library permission | "GAC Menu Editor needs photo library access to select dish images." |
| Android cleartext | Enabled via `expo-build-properties` plugin |

---

## 12. First-Run Initialization

On first startup, the backend automatically:

1. Creates `data/` and `data/locations/` directories
2. Initializes empty `data/locations.json` (`{ "locations": [] }`)
3. Generates a random 64-character hex JWT secret → `data/.jwt_secret`
4. Creates `data/admin.db` with default admin user (`admin` / `changeme123`, bcrypt hashed)
5. Creates `logs/` directory with rotating file handlers

On first location creation (`POST /locations`):
1. Creates `data/locations/{location_id}/`
2. Creates subdirectories: `images/`, `downloaded_images/`, `uploaded_images/`
3. Initializes empty `menu.json` and `facts.json` with `schema_version: "1.0"`

---

## 13. Logging

| Log File | Rotation | Content |
|----------|----------|---------|
| `logs/app.log` | 5MB, 3 backups | All requests, auth events, write operations, deploys |
| `logs/error.log` | 5MB, 3 backups | Errors and exceptions only |

Logged events include: authentication attempts (no passwords), all CRUD operations with identifiers, image processing results, deploy outcomes, backup/restore actions, and startup/shutdown.

---

## 14. Testing Architecture

### 14.1 Backend Tests (pytest)

```
tests/backend/
├── conftest.py          Fixtures: test client, auth headers, temp data dir, test location
├── test_auth.py         Login, password change, token validation, rate limiting
├── test_locations.py    Location CRUD, slug generation, duplicates, auth requirements
├── test_items.py        Menu item CRUD, validation, image cleanup, backup creation
├── test_facts.py        Facts CRUD, type validation, auth requirements
├── test_upload.py       Image upload, processing, format validation, size limits
└── test_deploy.py       Deploy to file-copy and HTTP targets, path traversal prevention
```

Run: `cd backend && pytest ../tests/backend/ -v`

Key fixture design:
- Each test gets an isolated `tmp_path` data directory
- `DISABLE_RATE_LIMIT=1` in test environment
- `test_location` fixture creates a fresh location per test

### 14.2 Mobile Tests (Jest)

```
tests/mobile/
├── api.test.js              API service layer: fetch calls, error handling, AuthError
├── MenuItemCard.test.js     Component rendering, popular badge, price formatting
└── MenuEditScreen.test.js   Form validation, save flow, image state
```

Run: `cd mobile && npm test`

Configuration: Jest with `react-native` preset, transforms configured for Expo modules.

### 14.3 Codebase Metrics

| Component | Files | Lines of Code |
|-----------|-------|---------------|
| Backend (Python) | ~15 | ~2,000 |
| Mobile (JavaScript) | ~20 | ~3,100 |
| Tests | ~9 | ~1,400 |
| **Total** | **~44** | **~6,500** |

---

## 15. Technology Stack Summary

### 15.1 Backend Dependencies

| Package | Version Range | Purpose |
|---------|---------------|---------|
| fastapi | >=0.115, <1.0 | REST API framework |
| uvicorn | >=0.30, <1.0 | ASGI server |
| python-jose[cryptography] | >=3.3, <4.0 | JWT encoding/decoding |
| passlib[bcrypt] | >=1.7.4, <2.0 | Password hashing |
| pillow | >=10.4, <11.0 | Image processing |
| pillow-heif | >=0.18, <1.0 | HEIC/HEIF support |
| python-multipart | >=0.09, <1.0 | File upload handling |
| requests | >=2.31, <3.0 | HTTP deploy targets |
| slowapi | >=0.1.9, <1.0 | Login rate limiting |
| python-dotenv | >=1.0, <2.0 | Environment file loading |

### 15.2 Mobile Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | 19.1.0 | UI framework |
| react-native | 0.81.5 | Cross-platform native bridge |
| expo | ~54.0.0 | Build system + dev tools |
| expo-image-picker | ~17.0.11 | Camera/gallery access |
| expo-secure-store | ~15.0.8 | Encrypted token storage |
| expo-status-bar | ~3.0.9 | Status bar styling |
| expo-build-properties | ~1.0.10 | Android build configuration |
| @react-native-async-storage/async-storage | 2.2.0 | Persistent key-value storage |
| @react-native-picker/picker | 2.11.1 | Native dropdown picker |

### 15.3 Dev Dependencies

| Package | Purpose |
|---------|---------|
| jest ^29.7 | Test runner |
| @testing-library/react-native ^12.9 | Component testing |
| babel-preset-expo ~54.0.10 | Babel transpilation for Expo |
| pytest (backend) | Python test framework |

---

## 16. Deployment Architecture

### 16.1 Current Setup

```
Ubuntu Server (LAN: 192.168.10.3)
├── GAC-Menu-editor/backend/     → uvicorn :8100
├── GAC-Concierge/               → :8000 (consumer)
├── GAC-Display/                 → :8600 (consumer)
└── ...other GAC services
```

The backend runs as a managed process via `editor_service.sh`. The mobile app connects over WiFi/LAN using the configured server host.

### 16.2 Mobile Distribution

| Stage | Method |
|-------|--------|
| Development | Expo Go on device (LAN) |
| Testing | Expo Go or development build |
| Production | EAS Build → APK (Android) / TestFlight (iOS) |

---

## 17. Data Flow Diagrams

### 17.1 Menu Item Edit

```
Staff (iPad) → MenuEditScreen → Save
    │
    ├── Image changed? → POST /upload (multipart) → Backend processes → WebP
    │
    └── PUT /items/{id} → Backend:
            ├── Create menu.json.bak
            ├── Old image ≠ new image? → Delete old image
            ├── Update item in menu.json
            └── Return updated item
    │
    ▼
Mobile updates local state → Toast "Item saved"
```

### 17.2 Data Publishing

```
Staff → Settings → "Deploy Now"
    │
    ▼
POST /deploy → Backend reads deploy_targets
    │
    ├── file_copy: cp menu.json + facts.json + images/ → consumer dir
    │   └── post_command: e.g., restart consumer service
    │
    └── http_post: POST JSON → consumer import endpoint
    │
    ▼
Update last_deployed_at → Return results
    │
    ▼
Consumer (e.g., GAC-Concierge) now has updated menu data
```

### 17.3 Consumer Polling

```
Consumer app (periodic)
    │
    ├── GET /locations/{id}/version → { menu_hash, facts_hash }
    │
    ├── Hash changed? → GET /locations/{id}/menu → Process new data
    │                 → GET /locations/{id}/menu/facts → Process new facts
    │
    └── No change → Skip
```

---

## 18. Error Handling

### 18.1 Backend Error Responses

All API errors return JSON with a `detail` field:

```json
{ "detail": "Human-readable error message" }
```

| HTTP Code | Scenario |
|-----------|----------|
| 400 | Validation failure, missing `confirm` flag |
| 401 | Missing/invalid/expired JWT |
| 404 | Location, item, or fact not found |
| 409 | Duplicate location name or item_id |
| 413 | Image exceeds 10MB |
| 422 | Pydantic validation error (auto-generated) |
| 429 | Rate limit exceeded (login) |
| 500 | Unhandled server error |

### 18.2 Mobile Error Handling

| Scenario | Behavior |
|----------|----------|
| 401 response | Clear token, redirect to login |
| Network timeout (10s) | Error toast, retain form data |
| Save failure | Error toast, keep user edits for retry |
| Server unreachable | Offline banner, cached data (read-only) |

### 18.3 Backup Recovery

```
Write attempt → Create .bak
    ├── Write succeeds → Done
    └── Write fails → Auto-restore from .bak → Log error → Raise exception
```

---

## 19. Offline Behavior

| Scenario | Behavior |
|----------|----------|
| No network on launch | Show cached menu/facts if available; "Offline — read only" banner |
| Network lost during edit | Error toast on save; retain form data |
| Network restored | Manual pull-to-refresh or "Retry" |
| Image capture offline | Image stored locally; upload deferred until save |

Full offline-first with sync queue is out of scope. Single-editor assumption makes conflict resolution unnecessary.

---

## 20. Constraints and Assumptions

| ID | Constraint |
|----|-----------|
| C01 | `menu.json` and `facts.json` schemas are the public contract; changes must be versioned |
| C02 | Backend runs on LAN only (port 8100); mobile app supports configurable host |
| C03 | Editor owns its data directory; consumers never write to it directly |
| C04 | Single concurrent editor — no multi-user conflict resolution |
| C05 | Expo Go development workflow required for rapid iteration |
| C06 | Each location's data is fully independent — no cross-location references |

| Assumption | Impact if Invalid |
|------------|------------------|
| LAN-only deployment | Would need TLS, stricter CORS, public auth hardening |
| < 500 menu items per location | Would need pagination on list endpoints |
| Single concurrent editor | Would need optimistic locking or CRDT |
| Staff have iOS/Android device | Would need web fallback |

---

## 21. Future Considerations

| Area | Enhancement | Priority |
|------|-------------|----------|
| Backup rotation | Timestamped backups (last N per file) instead of single `.bak` | Medium |
| Webhook notifications | Push change events to consumers instead of polling | Low |
| Offline edit queue | Queue edits locally and sync when reconnected | Low |
| Multi-user | Optimistic locking with version stamps on items/facts | Low |
| Search | Full-text search on backend (currently client-side filtering) | Low |
| Analytics | Track menu item popularity, edit frequency | Low |
| Audit log | Record who changed what and when | Medium |

---

## 22. Requirement Traceability

Key requirements and where they are implemented:

| Requirement | Backend | Mobile | Tests |
|-------------|---------|--------|-------|
| FR-M01–M10 (Menu CRUD) | `items.py` | `MenuListScreen`, `MenuEditScreen` | `test_items.py` |
| FR-F01–F07 (Facts CRUD) | `facts.py` | `FactsListScreen`, `FactEditScreen` | `test_facts.py` |
| FR-I01–I08 (Images) | `upload.py`, `image_processor.py` | `PhotoCapture`, `imageHelper.js` | `test_upload.py` |
| FR-A01–A08 (Auth) | `auth.py`, `database.py` | `LoginScreen`, `auth.js` | `test_auth.py` |
| FR-L01–L10 (Locations) | `locations.py` | `LocationPickerScreen` | `test_locations.py` |
| FR-P01–P07 (Publishing) | `deploy.py`, `export.py`, `deployer.py` | `SettingsScreen` | `test_deploy.py` |
| FR-S01–S05 (Server) | `main.py`, `config.py` | `api.js`, `SettingsModal` | — |
| NFR-S01–S07 (Security) | JWT, bcrypt, rate limiting, CORS | SecureStore, input validation | `test_auth.py` |
| NFR-R01–R04 (Reliability) | `backup.py`, logging | — | `test_items.py` |
