# System Design

## 1. Architecture Overview

GAC Menu Editor is a **self-contained system** with two components: an Expo Go mobile app and its own FastAPI backend. It is the authoritative source for menu data **across multiple restaurant locations**. Each location maintains an independent data set (menu items, facts, images) in its own directory. Consumer applications (e.g., GAC-Concierge) obtain data through the editor's read-only API, export packages, or the publish mechanism — but the editor has no runtime dependency on any consumer.

```
┌─────────────────────────────────────────────────────────────────┐
│                     GAC Menu Editor                              │
│                                                                  │
│  ┌──────────────────┐           ┌─────────────────────────────┐ │
│  │  Android Phone   │           │   iPhone / iPad             │ │
│  │  React Native    │           │   React Native              │ │
│  │  Expo Go / APK   │           │   Expo Go / TestFlight      │ │
│  └────────┬─────────┘           └──────────┬──────────────────┘ │
└───────────┼────────────────────────────────┼────────────────────┘
            │  HTTP LAN                       │  HTTP LAN
            ▼                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│           Menu Editor Backend (FastAPI)  :8100                   │
│                                                                  │
│   Admin Endpoints (JWT-protected):                               │
│   POST  /api/v1/auth/token          → Login, returns JWT        │
│   PUT   /api/v1/auth/password       → Change password           │
│   GET   /api/v1/locations           → List all locations        │
│   POST  /api/v1/locations           → Create location           │
│   PUT   /api/v1/locations/{loc_id}  → Update location           │
│   GET   /api/v1/locations/{loc_id}/items          → List items  │
│   POST  /api/v1/locations/{loc_id}/items          → Create item │
│   PUT   /api/v1/locations/{loc_id}/items/{item_id} → Update     │
│   DELETE /api/v1/locations/{loc_id}/items/{item_id} → Delete    │
│   GET   /api/v1/locations/{loc_id}/items/categories → List cats │
│   GET   /api/v1/locations/{loc_id}/facts          → List facts  │
│   POST  /api/v1/locations/{loc_id}/facts          → Create fact │
│   PUT   /api/v1/locations/{loc_id}/facts/{fact_id} → Update     │
│   DELETE /api/v1/locations/{loc_id}/facts/{fact_id} → Delete    │
│   POST  /api/v1/locations/{loc_id}/upload         → Upload img  │
│   POST  /api/v1/locations/{loc_id}/deploy         → Deploy data │
│   GET   /api/v1/locations/{loc_id}/export         → ZIP package │
│   GET   /api/v1/health              → Health check              │
│                                                                  │
│   Read-Only Endpoints (no auth, for consumers):                  │
│   GET   /api/v1/locations                → Location IDs + names │
│   GET   /api/v1/locations/{loc_id}/menu      → Full menu array  │
│   GET   /api/v1/locations/{loc_id}/menu/facts → Full facts      │
│   GET   /api/v1/locations/{loc_id}/version   → Data hashes      │
│                                                                  │
│   Static Files (per-location):                                   │
│   /locations/{loc_id}/images/*                                   │
│   /locations/{loc_id}/uploaded_images/*                           │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│               Data Layer (owned by Menu Editor)                  │
│   data/locations.json      Location registry                    │
│   data/.jwt_secret         Persisted JWT signing key            │
│   data/admin.db            Admin user credentials (SQLite)      │
│                                                                  │
│   data/locations/{location_id}/                                  │
│     menu.json              Location's menu items                │
│     menu.json.bak          Auto-backup before writes            │
│     facts.json             Location's facts                     │
│     facts.json.bak         Auto-backup before writes            │
│     images/                Original image assets                │
│     downloaded_images/     Previously-scraped image assets      │
│     uploaded_images/       Editor-uploaded images (WebP)        │
└─────────────────────────────────────────────────────────────────┘
            │
            │  Publish / Export / Read-Only API
            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Consumer Applications (independent)                 │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  GAC-Concierge   │  │  Future App  │  │  Website / CMS   │  │
│  │  (AI Waiter)     │  │              │  │                  │  │
│  └──────────────────┘  └──────────────┘  └──────────────────┘  │
│                                                                  │
│  Each consumer:                                                  │
│  • Pulls data from /api/v1/menu and /api/v1/menu/facts          │
│  • OR receives published ZIP/file copies                        │
│  • OR downloads export package                                  │
│  • Owns its own cache/index rebuild logic                       │
└─────────────────────────────────────────────────────────────────┘
```

### 1.1 Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Own standalone backend | Independence from any consumer application; the editor is the authoritative data source, not a plugin for another system. |
| Default port 8100 | Avoids conflict with consumer applications that may run on 8000. |
| Separate read-only and admin APIs | Consumers access data without authentication; edits require JWT. Clean separation of concerns. |
| Publish mechanism | Active push to consumer directories/APIs decouples the editor from consumer internals. |
| Data version endpoint | Consumers can poll `/api/v1/version` to detect changes without re-downloading full data. |
| Expo SDK 54 | Proven stack for cross-platform mobile; same SDK generation used in other GAC projects. |
| JavaScript (no TypeScript) | Consistent with existing GAC mobile codebase; lower friction. |
| Facts identified by `fact_id` | Each fact has a UUID `fact_id` for stable identification. Avoids fragile array-index addressing. Auto-generated on creation. |
| No pagination on list endpoints | Dataset is small (~160 menu items, ~10 facts). All items returned in a single response. Revisit if dataset grows beyond 500 items. |
| HEIC image support | Requires `pillow-heif` package in addition to Pillow. Added to backend dependencies. |
| Multi-location with isolated data | Each location gets its own subdirectory under `data/locations/{location_id}/`. Location data is fully independent — no shared items. The `locations.json` registry in `data/` tracks all locations. |
| Staging model (no direct edits to deployed data) | All edits happen in the location's staging directory. A "Deploy" action copies staged data to consumer targets. The editor never modifies consumer data in place. |

---

## 2. Project Structure

### 2.1 Directory Layout

```
GAC-Menu-Editor/
├── docs/                               Design documents
├── backend/
│   ├── main.py                         FastAPI app entry point
│   ├── config.py                       Environment config + defaults
│   ├── database.py                     SQLite admin user management
│   ├── schemas.py                      Pydantic models for validation
│   ├── requirements.txt                Python dependencies
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py                     Login + password change
│   │   ├── locations.py                Location CRUD + listing
│   │   ├── items.py                    Menu item CRUD (location-scoped)
│   │   ├── facts.py                    Facts CRUD (location-scoped)
│   │   ├── upload.py                   Image upload + processing
│   │   ├── deploy.py                   Deploy data to consumer targets
│   │   └── export.py                   ZIP export + read-only endpoints
│   └── services/
│       ├── __init__.py
│       ├── backup.py                   JSON backup/restore
│       ├── image_processor.py          Resize + WebP conversion
│       └── deployer.py                File copy / HTTP push to consumers
├── mobile/
│   ├── App.js                          Root component — navigation + auth
│   ├── app.json                        Expo config
│   ├── eas.json                        EAS build profiles
│   ├── index.js                        Expo entry point
│   ├── package.json
│   ├── assets/
│   │   ├── icon.png                    App icon
│   │   ├── adaptive-icon.png           Android adaptive icon
│   │   ├── splash-icon.png             Splash screen
│   │   └── favicon.png                 Web favicon
│   ├── plugins/
│   │   └── withCleartextTraffic.js     HTTP fix for Android 9+
│   ├── services/
│   │   ├── api.js                      All fetch() calls + host config
│   │   ├── auth.js                     JWT token management + secure storage
│   │   └── imageHelper.js             Camera/gallery picker + upload logic
│   ├── components/
│   │   ├── MenuItemCard.js             Item card for list view
│   │   ├── FactCard.js                 Fact card for list view
│   │   ├── LocationCard.js             Location card for picker
│   │   ├── PhotoCapture.js             Camera/gallery image picker + preview
│   │   ├── CategoryPicker.js           Horizontal scrolling category tabs
│   │   ├── SearchBar.js                Search input with debounce
│   │   ├── Toast.js                    Success/error toast notifications
│   │   ├── ConfirmDialog.js            Destructive action confirmation
│   │   └── SettingsModal.js            Server host configuration
│   └── screens/
│       ├── LoginScreen.js              Authentication screen
│       ├── LocationPickerScreen.js     Select active location
│       ├── MenuListScreen.js           Browse/search menu items
│       ├── MenuEditScreen.js           Add/edit a single menu item
│       ├── FactsListScreen.js          Browse facts
│       ├── FactEditScreen.js           Add/edit a single fact
│       └── SettingsScreen.js           Server config, deploy, account
├── data/                               Menu data directory
│   ├── locations.json                  Location registry
│   ├── .jwt_secret                     Persisted JWT signing key
│   └── locations/                      Per-location data
│       └── {location_id}/
│           ├── menu.json               Menu items (schema_version + items)
│           ├── facts.json              Facts (schema_version + facts)
│           ├── images/                 Original image assets
│           ├── downloaded_images/      Previously-scraped assets
│           └── uploaded_images/        Editor-uploaded images
├── logs/                               Rotating log files
│   ├── app.log                         All requests and events
│   └── error.log                       Errors only
├── tests/
│   ├── backend/                        pytest tests for API
│   │   ├── test_auth.py
│   │   ├── test_locations.py
│   │   ├── test_items.py
│   │   ├── test_facts.py
│   │   ├── test_upload.py
│   │   └── test_deploy.py
│   └── mobile/                         Jest tests for components
│       ├── api.test.js
│       ├── MenuItemCard.test.js
│       └── MenuEditScreen.test.js
├── scripts/
│   └── editor_service.sh               Start/stop/status for backend
└── README.md
```

### 2.2 State Architecture (Mobile App)

All primary state lives in `App.js`.

| State | Type | Purpose |
|-------|------|---------|
| `isAuthenticated` | boolean | Auth gate for app content |
| `token` | string | JWT token for API calls |
| `locations` | array | All available locations from server |
| `activeLocation` | object\|null | Currently selected location (null = show picker) |
| `activeTab` | string | Current bottom nav tab: `menu`, `facts`, `settings` |
| `menuItems` | array | Full menu from active location |
| `facts` | array | Full facts from active location |
| `categories` | array | Derived category list |
| `activeCategory` | string | Selected category filter |
| `searchQuery` | string | Current search text |
| `serverHost` | string | Configured backend address |
| `isConnected` | boolean | Backend reachability flag |
| `editingItem` | object\|null | Item being edited (null = add new) |
| `editingFact` | object\|null | Fact being edited (null = add new) |

---

## 3. Screen Designs

### 3.1 Navigation Structure

App flow: Login → Location Picker → Three-tab navigation.

```
Login → Location Picker → ┌─────────────────────────────────────┐
                           │ [Location Name ▼]     [↺ Refresh]  │
                           ├─────────────────────────────────────┤
                           │         [Screen Content]            │
                           ├─────────────────────────────────────┤
                           │  🍽 Menu  │  ℹ️ Facts  │  ⚙️ Settings │
                           └─────────────────────────────────────┘
```

The location name is always visible in the header. Tapping it opens the location picker to switch.

Plus a Floating Action Button (FAB) on list screens for "Add New".

### 3.1a Location Picker Screen

Shown after login and when switching locations.

```
┌─────────────────────────────────────────────┐
│          Select Location                    │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │  📍 Garden Grove                        │ │
│ │     142 items · 5 facts                 │ │
│ │     Last deployed: 2026-04-27 14:30     │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │  📍 Westminster                         │ │
│ │     138 items · 5 facts                 │ │
│ │     Never deployed                      │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │  📍 Fountain Valley                     │ │
│ │     0 items · 0 facts                   │ │
│ │     Never deployed                      │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│                                     [＋]    │
└─────────────────────────────────────────────┘
```

- Shows all locations with item/fact counts and deploy status
- Tapping a location loads its data and enters the main app
- FAB for adding a new location (admin only)

### 3.2 Login Screen

```
┌─────────────────────────────────────────────┐
│                                             │
│              [🍽 Icon]                       │
│                                             │
│          GAC Menu Editor                    │
│     Garlic & Chives Menu Manager            │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Server Host: 192.168.10.3:8100    │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │  Username                           │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │  Password                           │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │           Sign In                    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│         [Test Connection]                   │
│                                             │
└─────────────────────────────────────────────┘
```

- Server host field visible on login screen for easy LAN configuration
- "Test Connection" button pings `/api/v1/health` with 5s timeout
- On success, stores JWT and navigates to Location Picker

### 3.3 Menu List Screen

```
┌─────────────────────────────────────────────┐
│ Menu Items                      142 items   │
├─────────────────────────────────────────────┤
│ 🔍 Search by name...                        │
├─────────────────────────────────────────────┤
│ [All] [Seafood] [Meat] [Soup] [Rice] →      │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ 🖼️  Honey Walnut Shrimps        $13.00 │ │
│ │     Tôm Walnut Mật Ong           ⭐    │ │
│ │     Seafood                  [Edit ›]  │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ 🖼️  Baked Crispy Catfish         $22.00 │ │
│ │     Cá Nướng Da Giòn Thịt Luộc   ⭐    │ │
│ │     Seafood                  [Edit ›]  │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ 🖼️  House Special Pork Chops     $12.00 │ │
│ │     Sườn Heo Đặc Biệt                  │ │
│ │     Meat & Poultry           [Edit ›]  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│                                     [＋]    │
├─────────────────────────────────────────────┤
│   🍽 Menu    │    ℹ️ Facts    │    ⚙️ Settings │
└─────────────────────────────────────────────┘
```

- Pull-to-refresh support
- Thumbnail image on the left of each card
- Vietnamese name displayed below English name
- Popular badge (⭐) for items with `popular: true`
- FAB [＋] navigates to blank edit form

### 3.4 Menu Edit Screen

```
┌─────────────────────────────────────────────┐
│ ← Back          Edit Item          [Save]   │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │                                         │ │
│ │     📷  Tap to take photo               │ │
│ │         or choose from gallery          │ │
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│  Item Name (English) *                      │
│  ┌─────────────────────────────────────┐    │
│  │  Honey Walnut Shrimps with Chips    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Vietnamese Name                            │
│  ┌─────────────────────────────────────┐    │
│  │  Tôm Walnut Mật Ong với Bánh Phồng │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Pronunciation                              │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Category *              Price (USD) *      │
│  ┌──────────────────┐   ┌──────────────┐   │
│  │  Seafood       ▼ │   │  $ 13.00     │   │
│  └──────────────────┘   └──────────────┘   │
│                                             │
│  Description (English) *                    │
│  ┌─────────────────────────────────────┐    │
│  │  Indulge in our Honey Walnut...     │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Description (Vietnamese)                   │
│  ┌─────────────────────────────────────┐    │
│  │  Hãy thưởng thức Tôm walnut...     │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [⭐ Popular]  [✓ Available]                │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │          Save Changes                │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │          🗑 Delete Item              │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

- Image area at top — tapping opens camera/gallery action sheet
- Category uses a dropdown/picker with existing categories + option to type new
- Popular and Available are toggle switches
- Delete button only shown when editing existing items (not on "Add New")
- Keyboard-aware scroll view to avoid input fields being hidden

### 3.5 Facts List Screen

```
┌─────────────────────────────────────────────┐
│ Facts                             5 items   │
├─────────────────────────────────────────────┤
│ 🔍 Search facts...                          │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │  Restaurant Overview        general_info │ │
│ │  Garlic & Chives, nestled in Garden...  │ │
│ │                                [Edit ›] │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │  Specials of the Day        general_info │ │
│ │  Our current specials include...        │ │
│ │                                [Edit ›] │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│                                     [＋]    │
├─────────────────────────────────────────────┤
│   🍽 Menu    │    ℹ️ Facts    │    ⚙️ Settings │
└─────────────────────────────────────────────┘
```

### 3.6 Fact Edit Screen

```
┌─────────────────────────────────────────────┐
│ ← Back          Edit Fact          [Save]   │
├─────────────────────────────────────────────┤
│                                             │
│  Topic *                                    │
│  ┌─────────────────────────────────────┐    │
│  │  Specials of the Day               │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Type                                       │
│  ┌─────────────────────────────────────┐    │
│  │  general_info                    ▼  │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Content *                                  │
│  ┌─────────────────────────────────────┐    │
│  │  Our current specials include:      │    │
│  │  - Monday: Lemongrass Seafood Soup  │    │
│  │  - Tuesday: Egg Rolls              │    │
│  │  - Weekend: Crispy Peking Duck...  │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │          Save Changes                │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │          🗑 Delete Fact              │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

### 3.7 Settings Screen

```
┌─────────────────────────────────────────────┐
│ Settings                                    │
├─────────────────────────────────────────────┤
│                                             │
│  Server Connection                          │
│  ┌─────────────────────────────────────┐    │
│  │  Host: 192.168.10.3:8100           │    │
│  │  Status: ● Connected               │    │
│  │  [Test Connection]  [Change Host]   │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Deploy Data                                │
│  ┌─────────────────────────────────────┐    │
│  │  Location: Garden Grove             │    │
│  │  Targets: 1 configured             │    │
│  │  Last deployed: 2026-04-27 14:30   │    │
│  │  [Deploy Now]                       │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Account                                    │
│  ┌─────────────────────────────────────┐    │
│  │  [Change Password]                  │    │
│  │  [Sign Out]                         │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Data Summary                               │
│  ┌─────────────────────────────────────┐    │
│  │  Menu Items: 142                    │    │
│  │  Facts: 5                           │    │
│  │  Data Version: a3f8c2...           │    │
│  │  [Force Refresh All Data]           │    │
│  │  [Export ZIP Package]               │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  About                                      │
│  ┌─────────────────────────────────────┐    │
│  │  GAC Menu Editor v1.0.0             │    │
│  │  Expo SDK 54 | React Native 0.81    │    │
│  └─────────────────────────────────────┘    │
│                                             │
├─────────────────────────────────────────────┤
│   🍽 Menu    │    ℹ️ Facts    │    ⚙️ Settings │
└─────────────────────────────────────────────┘
```

---

## 4. API Design

All endpoints are served by the Menu Editor's own FastAPI backend on port 8100 (configurable).

### 4.1 Admin Endpoints (JWT-Protected)

#### Authentication

```
POST /api/v1/auth/token
Body: { "username": "admin", "password": "..." }
Response: { "access_token": "...", "token_type": "bearer", "password_is_default": false }
```

```
PUT /api/v1/auth/password
Headers: Authorization: Bearer <token>
Body: { "current_password": "...", "new_password": "..." }
Response: { "message": "Password updated" }
```

#### Location Management

```
GET /api/v1/locations
Headers: Authorization: Bearer <token>
Response: { "locations": [{ "location_id": "garden-grove", "name": "Garden Grove", "address": "...", "item_count": 142, "fact_count": 5, "last_deployed_at": "2026-04-27T14:30:00Z" }, ...] }
```

**Note**: `GET /api/v1/locations` is dual-purpose. With a JWT, it returns full details (counts, deploy status, address). Without auth, it returns only `location_id` and `name` — sufficient for consumer apps to discover valid locations (see §4.2).

```
POST /api/v1/locations
Headers: Authorization: Bearer <token>
Body: { "name": "Westminster", "address": "..." }
Response: { "location": { "location_id": "westminster", ... }, "message": "Location created" }
```

```
PUT /api/v1/locations/{location_id}
Headers: Authorization: Bearer <token>
Body: { "name": "...", "address": "..." }
Response: { "location": {...}, "message": "Location updated" }
```

```
DELETE /api/v1/locations/{location_id}
Headers: Authorization: Bearer <token>
Response: { "message": "Location deleted" }
```

#### Menu Items (Location-Scoped)

```
GET /api/v1/locations/{location_id}/items?search=&category=
Headers: Authorization: Bearer <token>
Response: { "items": [...], "total": 142 }
```

```
POST /api/v1/locations/{location_id}/items
Headers: Authorization: Bearer <token>
Body: { "item_name": "...", "price": 13, "category": "Seafood", ... }
Response: { "item": { "item_id": "honey-walnut-shrimps", ... }, "message": "Item created" }
```

```
PUT /api/v1/locations/{location_id}/items/{item_id}
Headers: Authorization: Bearer <token>
Body: { "item_name": "Updated Name", "price": 15, "description": "Updated...", "image_path": "..." }
Response: { "item": {...}, "message": "Item updated" }
```

If the request includes a new `image_path` that differs from the existing one, the backend deletes the old image file before saving.

```
DELETE /api/v1/locations/{location_id}/items/{item_id}
Headers: Authorization: Bearer <token>
Response: { "message": "Item deleted" }
```

```
GET /api/v1/locations/{location_id}/items/categories
Headers: Authorization: Bearer <token>
Response: { "categories": ["Appetizers", "Seafood", ...] }
```

**Item identification**: Items are identified by `item_id` (a stable slug auto-generated from `item_name` at creation time, e.g., `honey-walnut-shrimps`). The `item_id` is immutable — renaming the dish updates `item_name` but not `item_id`. This avoids URL-encoding issues and breakage on rename.

#### Facts (Location-Scoped)

```
GET /api/v1/locations/{location_id}/facts
Headers: Authorization: Bearer <token>
Response: { "facts": [...], "total": 5 }
```

```
POST /api/v1/locations/{location_id}/facts
Headers: Authorization: Bearer <token>
Body: { "topic": "...", "content": "...", "type": "general_info" }
Response: { "fact": { "fact_id": "a1b2c3d4-...", ... }, "message": "Fact created" }
```

```
PUT /api/v1/locations/{location_id}/facts/{fact_id}
Headers: Authorization: Bearer <token>
Body: { "topic": "...", "content": "...", "type": "..." }
Response: { "fact": {...}, "message": "Fact updated" }
```

```
DELETE /api/v1/locations/{location_id}/facts/{fact_id}
Headers: Authorization: Bearer <token>
Response: { "message": "Fact deleted" }
```

**Fact identification**: Facts are identified by `fact_id` (UUID auto-generated on creation).

#### Image Upload (Location-Scoped)

```
POST /api/v1/locations/{location_id}/upload
Headers: Authorization: Bearer <token>
Body: multipart/form-data { file: <image>, item_name: "...", category: "..." }
Response: { "image_path": "./uploaded_images/Seafood_Honey_Walnut_Shrimps.webp" }
```

#### Deploy (Location-Scoped)

```
POST /api/v1/locations/{location_id}/deploy
Headers: Authorization: Bearer <token>
Body: { "targets": ["all"] }   (optional; defaults to all configured targets for this location)
Response: {
    "results": [
        { "target": "GAC-Concierge /data/", "status": "success" },
        { "target": "http://other-app:9000/import", "status": "failed", "error": "Connection refused" }
    ]
}
```

#### Export (Location-Scoped)

```
GET /api/v1/locations/{location_id}/export
Headers: Authorization: Bearer <token>
Response: application/zip file download
```

### 4.2 Read-Only Endpoints (No Authentication)

These endpoints allow any consumer application to pull current menu data without credentials. All data endpoints are location-scoped.

```
GET /api/v1/locations
Response: { "locations": [{ "location_id": "garden-grove", "name": "Garden Grove" }, ...] }
(Public listing of location IDs and names for consumer discovery — no counts or deploy info)
```

```
GET /api/v1/locations/{location_id}/menu
Response: { "schema_version": "1.0", "items": [{ "item_id": "...", "item_name": "...", "price": 13, ... }, ...] }
(Returns schema version and items array, matching the format consumers expect)
```

```
GET /api/v1/locations/{location_id}/menu/facts
Response: { "schema_version": "1.0", "facts": [{ "fact_id": "...", "topic": "...", "content": "...", "type": "..." }, ...] }
(Returns schema version and facts array)
```

```
GET /api/v1/health
Response: { "status": "ok", "version": "1.0.0" }
```

```
GET /api/v1/locations/{location_id}/version
Response: { "menu_hash": "a3f8c2...", "facts_hash": "b7d1e4...", "last_modified": "2026-04-27T14:30:00Z" }
(Consumers poll this to detect data changes without re-downloading)
```

**Static image files** are served without auth at:
- `/locations/{location_id}/images/{filename}`
- `/locations/{location_id}/downloaded_images/{filename}`
- `/locations/{location_id}/uploaded_images/{filename}`

### 4.3 Image Processing Pipeline

Handled server-side by the Menu Editor backend:

1. Validate file type (JPEG, PNG, WebP, HEIC)
2. Resize to max 800px on longest edge (maintain aspect ratio)
3. Convert to WebP at 85% quality
4. Generate filename: `{Category}_{Sanitized_Item_Name}.webp`
5. Save to `data/locations/{location_id}/uploaded_images/`
6. Return relative path

**Image cleanup on item update**: When a menu item is updated via `PUT .../items/{item_id}` and the new `image_path` differs from the existing one, the backend deletes the old image file.

**Image cleanup on item delete**: When a menu item is deleted via `DELETE /api/v1/locations/{location_id}/items/{item_id}`, the backend also deletes the item's associated image file from that location's `uploaded_images/` directory if one exists.

**Static file serving**: The entire `data/locations/` directory is mounted as a single static file root at startup (e.g., `StaticFiles(directory="data/locations")`). This means images for dynamically-created locations are automatically served without restarting the backend. Images are accessible at `/locations/{location_id}/uploaded_images/{filename}`.

### 4.4 Error Response Format

```json
{
    "detail": "Human-readable error message",
    "code": "VALIDATION_ERROR"
}
```

Standard error codes: `VALIDATION_ERROR`, `NOT_FOUND`, `DUPLICATE_ITEM`, `LOCATION_NOT_FOUND`, `AUTH_FAILED`, `TOKEN_EXPIRED`, `RATE_LIMITED`, `SERVER_ERROR`, `DEPLOY_FAILED`.

---

## 5. Data Deployment

### 5.1 Deploy Mechanism

Each location has its own set of deploy targets. The editor pushes a location's data (menu.json, facts.json, images) to the configured targets for that location. This is the primary way consumers receive updated menu data.

```
┌─────────────────────┐
│   Menu Editor       │
│   POST /api/v1/     │
│   locations/{loc}/  │
│        deploy       │
└─────────┬───────────┘
          │
          ├──► File Copy Target
          │    Copy menu.json, facts.json, images/
          │    from data/locations/{loc}/ to a
          │    local/network directory
          │    (e.g., ../GAC-Concierge/data/)
          │
          ├──► HTTP POST Target
          │    POST data package to a remote
          │    import endpoint
          │
          └──► Custom Script Target
               Run a shell command after
               deploying (e.g., restart
               consumer service)
```

### 5.2 Deploy Configuration

Deploy targets are stored per-location in `data/locations.json` and managed by editing the file directly on the server (not via the mobile app). This keeps the mobile UI simple while giving the admin full control over target configuration.

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
                },
                {
                    "name": "Remote App",
                    "type": "http_post",
                    "url": "http://remote-server:9000/api/import",
                    "auth_token": "...",
                    "include_images": false
                }
            ]
        }
    ]
}
```

### 5.3 Deploy Flow

```
User taps "Deploy Now" in Settings (for active location)
       │
       ▼
Mobile app: POST /api/v1/locations/{location_id}/deploy
       │
       ▼
Backend reads deploy_targets for this location from locations.json:
  ├── File Copy: cp data/locations/{loc}/*.json → target path
  │              rsync data/locations/{loc}/images/ → target path
  │              Run post_command if configured
  │
  └── HTTP POST: Package data → POST to target URL
       │
       ▼
Backend updates last_deployed_at for this location
       │
       ▼
Backend returns per-target results
       │
       ▼
Mobile app shows success/failure toast for each target
```

### 5.4 Consumer Integration Patterns

Consumer applications can obtain data from the editor in three ways:

| Pattern | Mechanism | Use Case |
|---------|-----------|----------|
| **Pull** | Consumer calls `GET /api/v1/locations/{loc_id}/menu` and `.../menu/facts` | Consumer runs on a schedule or on-demand |
| **Push** | Editor deploys to consumer's data directory or import API | Editor user explicitly triggers deploy |
| **Poll** | Consumer polls `GET /api/v1/locations/{loc_id}/version` and re-fetches when hash changes | Consumer detects updates automatically |

The editor does not know or care about consumer internals (RAG indexes, caches, AI agents). Consumers are responsible for processing received data.

---

## 6. Data Flow

### 6.1 Edit Menu Item Flow

```
User taps item card
       │
       ▼
MenuListScreen → navigate to MenuEditScreen(item)
       │
       ▼
MenuEditScreen displays form with pre-populated fields
       │  User edits fields, optionally captures new photo
       ▼
User taps "Save Changes"
       │
       ▼
Client validates required fields (item_name, price, category, description)
       │  Fails → show inline validation errors
       ▼
If new image captured:
  ├── POST /api/v1/locations/{location_id}/upload (multipart with image)
  └── Receive image_path in response
       │
       ▼
PUT /api/v1/locations/{location_id}/items/{item_id}
  ├── Backend creates menu.json.bak
  ├── Backend updates menu.json in data/locations/{location_id}/
  └── Returns updated item
       │
       ▼
Client updates local menuItems state
       │
       ▼
Show success toast → navigate back to MenuListScreen
```

### 6.2 Add New Item Flow

```
User taps FAB [＋]
       │
       ▼
MenuEditScreen(null) — blank form
       │  User fills all fields, captures photo
       ▼
User taps "Save"
       │
       ▼
Client validates:
  ├── item_name is unique (check against local menuItems)
  ├── price >= 0
  ├── category non-empty
  └── description non-empty
       │
       ▼
If image captured:
  POST /api/v1/locations/{location_id}/upload → receive image_path
       │
       ▼
POST /api/v1/locations/{location_id}/items (full item object)
  ├── Backend generates item_id from item_name
  ├── Backend validates item_id uniqueness
  ├── Backend creates menu.json.bak
  ├── Backend appends to menu.json in data/locations/{location_id}/
  └── Returns created item (with item_id)
       │
       ▼
Client appends to local menuItems → show toast → navigate back
```

### 6.3 Image Capture Flow

```
User taps image area
       │
       ▼
ActionSheet presents:
  ├── 📷 Take Photo (expo-image-picker camera)
  └── 🖼 Choose from Gallery (expo-image-picker library)
       │
       ▼
expo-image-picker returns local URI
       │
       ▼
PhotoCapture component displays preview
       │  User can retake or accept
       ▼
On form save:
  POST /api/v1/locations/{location_id}/upload (multipart/form-data)
       │
       ▼
Menu Editor backend processes → returns relative path
       │
       ▼
Item saved with new image_path
```

---

## 7. Technology Stack

### 7.1 Mobile App

| Technology | Version | Purpose |
|-----------|---------|---------|
| React Native | 0.81+ | Cross-platform UI framework |
| Expo SDK | 54+ | Build system, dev tools, native modules |
| Expo Go | Latest | Development/testing on device |
| expo-image-picker | Latest | Camera and gallery access |
| expo-secure-store | Latest | Secure JWT token storage |
| @react-native-async-storage/async-storage | 2.2+ | Server host persistence |
| @react-native-picker/picker | 2.11+ | Native dropdown picker (category, fact type) |
| EAS Build | Latest | Production APK/IPA builds |

### 7.2 Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.10+ | Backend runtime |
| FastAPI | Latest | REST API framework |
| Uvicorn | Latest | ASGI server |
| python-jose | Latest | JWT token generation and validation |
| Pillow | Latest | Image resize and WebP conversion |
| python-multipart | Latest | File upload handling |
| passlib + bcrypt | Latest | Password hashing |
| pillow-heif | Latest | HEIC/HEIF image format support for Pillow |
| slowapi | Latest | Rate limiting on login endpoint |
| SQLite | Built-in | Admin user credential storage |

### 7.3 Expo Plugins

| Plugin | Purpose |
|--------|---------|
| `expo-build-properties` | Android cleartext traffic config |
| `withCleartextTraffic` | Custom plugin for HTTP on Android 9+ |

---

## 8. Security Design

### 8.1 Authentication Flow

```
App Launch
    │
    ├── Check SecureStore for saved token
    │       ├── Token found → validate via GET /api/v1/locations (JWT-protected)
    │       │       ├── 200 OK → show location picker
    │       │       └── 401 → show login
    │       └── No token → show login
    │
    ▼
Login Screen
    │  POST /api/v1/auth/token
    ▼
    ├── Success → store token in SecureStore
    │       ├── Response includes `password_is_default: true` → show Change Password prompt
    │       └── Otherwise → show location picker
    └── Failure → show error
```

### 8.2 Token Management

- Tokens stored in `expo-secure-store` (Keychain on iOS, EncryptedSharedPreferences on Android)
- Token expiration: 8 hours (configurable via `JWT_EXPIRE_MINUTES`) — aligned with a work shift so staff don't need to re-authenticate mid-session
- On 401 response, clear token and redirect to login
- No refresh token — user re-authenticates after expiry

### 8.3 API Security Layers

| Layer | Protection |
|-------|-----------|
| Admin endpoints | JWT Bearer token required |
| Read-only endpoints | No auth (public menu data for consumers) |
| Image upload | JWT + file type validation + size limit (10MB) |
| Deploy | JWT + target path validation (no path traversal) |
| Login | Optional rate limiting via slowapi (5 attempts/minute) — low risk on LAN |
| Password storage | bcrypt hashing in SQLite |

### 8.4 Input Validation

| Layer | Validation |
|-------|-----------|
| Client | Required field checks, price >= 0, item_name uniqueness (local check) |
| Server | Pydantic schema validation, item_name uniqueness (authoritative), file type validation, path traversal prevention on image filenames and deploy targets, location_id existence validation |

---

## 9. Offline Behavior

| Scenario | Behavior |
|----------|----------|
| No network on launch | Show cached menu/facts if available; banner "Offline — read only" |
| Network lost during edit | Show error toast on save attempt; retain form data |
| Network restored | Manual pull-to-refresh or "Retry" button |
| Image capture offline | Image stored locally; upload deferred until save (which requires network) |

Offline support is minimal (read-only cached data). Full offline-first with sync is out of scope.

---

## 10. Landscape Layout

Using `useWindowDimensions()` for orientation detection:

### Portrait (default)

Three-tab bottom navigation with full-width content area.

### Landscape

Two-panel split: list on left, edit form on right (when editing).

```
┌─────────────────────────────────────────────────────┐
│  GAC Menu Editor                      [↺ Refresh]  │
├────────────────────────┬────────────────────────────┤
│  🔍 Search...          │  Edit: Honey Walnut...     │
│  [All] [Seafood] [→]   │                            │
├────────────────────────┤  📷 [Image Area]            │
│  Honey Walnut Shri... │                            │
│  Baked Crispy Cat...  │  Name: _______________     │
│  Crispy Peking Du...  │  Viet: _______________     │
│  House Special Sq...  │  Price: ___  Cat: ___      │
│  ...                   │  Desc: _____________      │
│                        │                            │
│                        │  [Save]  [Delete]          │
├────────────────────────┴────────────────────────────┤
│   🍽 Menu    │    ℹ️ Facts    │    ⚙️ Settings        │
└─────────────────────────────────────────────────────┘
```

---

## 11. Environment Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATA_DIR` | No | `./data` | Path to data directory |
| `BACKEND_HOST` | No | `0.0.0.0` | Backend server bind host |
| `BACKEND_PORT` | No | `8100` | Backend server port |
| `JWT_SECRET_KEY` | No | Auto-generated and persisted | Secret for JWT signing. On first run, a random key is generated and saved to `data/.jwt_secret`. Subsequent restarts read from this file to avoid invalidating active tokens. |
| `JWT_EXPIRE_MINUTES` | No | `480` | Token expiration time (8 hours suits a shift-length editing session) |
| `ADMIN_DEFAULT_PASSWORD` | No | `changeme123` | Initial password on first run |
| `LOGIN_RATE_LIMIT` | No | `5` | Max login attempts per minute |
| `LOCATIONS_FILE` | No | `./data/locations.json` | Path to locations registry |
| `LOG_DIR` | No | `./logs` | Directory for rotating log files |
| `LOG_LEVEL` | No | `INFO` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `ALLOWED_ORIGINS` | No | `["*"]` | CORS allowed origins. `["*"]` is appropriate for LAN-only deployments. |

---

## 12. First-Run Initialization

On first startup (no existing data detected), the backend:

1. Creates the `data/` directory and `data/locations/` subdirectory.
2. Initializes an empty `data/locations.json` with `{ "locations": [] }` if not present.
3. Generates a random `JWT_SECRET_KEY` and persists it to `data/.jwt_secret`.
4. Creates the SQLite `admin.db` with a default admin user (password: `changeme123`).
5. Logs a startup message indicating first-run initialization completed.

When the first location is created via `POST /api/v1/locations`, the backend creates `data/locations/{location_id}/` with subdirectories (`images/`, `uploaded_images/`, `downloaded_images/`) and empty `menu.json` and `facts.json` files.

The `/api/v1/auth/token` response includes a `password_is_default` boolean flag so the mobile app can prompt the user to change the default password.

---

## 13. CORS Configuration

The backend configures CORS middleware to allow all origins for LAN access:

```python
# CORS setup in main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

This is appropriate for a LAN-only application where all clients are on the same trusted network.

---

## 14. Logging Strategy

The backend uses Python's `logging` module with rotating file handlers:

| Log | Location | Rotation | Content |
|-----|----------|----------|---------|
| `app.log` | `logs/app.log` | 5MB, 3 backups | All requests, responses, startup info |
| `error.log` | `logs/error.log` | 5MB, 3 backups | Errors and exceptions only |

Key events logged:
- Server start/stop
- Authentication attempts (success and failure, without passwords)
- All write operations (create, update, delete) with item identifiers and location_id
- Image upload and processing results
- Deploy operations and per-target outcomes
- Backup creation and restore events

---

## 15. Backup Strategy

### 15.1 Single-File Backup (Current Design)

Before each write to a location's `menu.json` or `facts.json`, the backend copies the current file to `*.bak`.

**Limitation**: A single `.bak` file is overwritten on every save. If a corrupt save is followed by another save, the backup is also lost.

### 15.2 Recommended Enhancement (Future)

Maintain a small rotation of timestamped backups:

```
data/locations/{location_id}/backups/
  menu_2026-04-27T14-30-00.json
  menu_2026-04-27T12-15-00.json
  facts_2026-04-27T14-30-00.json
```

Retain the last N backups (configurable, default 5) and auto-prune older ones. This provides a recovery window if corruption is not caught immediately.

---

## 16. Service Management

```bash
# Start/stop the Menu Editor backend
./scripts/editor_service.sh start | stop | restart | status
```

The backend runs independently. It does not start, stop, or manage any consumer application process.
