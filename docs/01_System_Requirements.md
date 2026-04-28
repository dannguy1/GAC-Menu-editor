# System Requirements

## 1. Project Overview

**GAC Menu Editor** is a standalone mobile application with its own backend for managing the Garlic & Chives restaurant menu database across **multiple locations**. It is the **authoritative source** for menu items (`menu.json`), restaurant facts (`facts.json`), and food images. Each location maintains its own menu data set with potentially different prices and menu items. Consumer applications such as GAC-Concierge read from this data but are not required for the editor to function.

### 1.1 Problem Statement

The current GAC Menu Admin (React + Vite PWA with FastAPI backend) proved the concept but revealed that a native mobile experience is better suited for the primary use case: staff photographing dishes with their phones and updating the menu on the go. An Expo Go-based app provides native camera access, offline photo capture, and a more natural mobile workflow. The editor must be self-contained — it manages menu data independently and publishes it to any number of downstream consumers.

### 1.2 Target Users

- Restaurant owner/manager (primary)
- Designated staff members with edit permissions

### 1.3 Target Platforms

| Platform | Distribution Method |
|----------|-------------------|
| Android | Expo Go (dev), EAS Build APK (production) |
| iOS | Expo Go (dev), EAS Build / TestFlight (production) |

---

## 2. Functional Requirements

### 2.1 Menu Item Management

| ID | Requirement | Priority |
|----|------------|----------|
| FR-M01 | WHEN a user opens the app, THE SYSTEM SHALL display a searchable, scrollable list of all menu items from the active location's `menu.json`. | Must |
| FR-M02 | WHEN a user taps a menu item, THE SYSTEM SHALL open an edit form pre-populated with all fields for that item. | Must |
| FR-M03 | WHEN a user taps the "Add Item" button, THE SYSTEM SHALL open a blank form for creating a new menu item. | Must |
| FR-M04 | WHEN a user submits a menu item form, THE SYSTEM SHALL validate all required fields before saving. | Must |
| FR-M05 | WHEN a user saves a menu item, THE SYSTEM SHALL persist the change to the active location's `menu.json` on the Menu Editor backend. | Must |
| FR-M06 | WHEN a user selects a category filter, THE SYSTEM SHALL display only items matching that category. | Must |
| FR-M07 | WHEN a user types in the search field, THE SYSTEM SHALL filter items by name (English and Vietnamese). | Must |
| FR-M08 | WHEN a user deletes a menu item, THE SYSTEM SHALL show a confirmation dialog before removing it from the active location's `menu.json`. | Must |
| FR-M09 | WHERE a menu item has `popular: true`, THE SYSTEM SHALL display a visual badge on the item card. | Should |
| FR-M10 | WHEN a user edits an item, THE SYSTEM SHALL allow toggling the `popular` flag. | Should |

### 2.2 Menu Item Data Fields

Each menu item supports the following fields (the canonical `menu.json` schema owned by this project):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `item_id` | string | Yes | Stable unique identifier (auto-generated slug from `item_name`; immutable after creation) |
| `item_name` | string | Yes | English dish name (display name, editable) |
| `item_viet` | string | No | Vietnamese dish name |
| `pronunciation` | string | No | Phonetic pronunciation guide |
| `description` | string | Yes | English description |
| `description_viet` | string | No | Vietnamese description |
| `price` | number | Yes | Price in USD (>= 0) |
| `category` | string | Yes | Menu category |
| `popular` | boolean | No | Popular item flag (default: false) |
| `available` | boolean | No | Availability flag (default: true) |
| `image_path` | string | No | Relative path to dish image |

### 2.3 Image Management

| ID | Requirement | Priority |
|----|------------|----------|
| FR-I01 | WHEN a user taps the image area on an item form, THE SYSTEM SHALL offer options to take a photo or choose from gallery. | Must |
| FR-I02 | WHEN a user captures or selects an image, THE SYSTEM SHALL display a preview before upload. | Must |
| FR-I03 | WHEN a user confirms an image, THE SYSTEM SHALL upload it to the Menu Editor backend and update the item's `image_path`. | Must |
| FR-I04 | WHEN an image is uploaded, THE SYSTEM SHALL process it server-side (resize to max 800px, convert to WebP at 85% quality). | Must |
| FR-I05 | THE SYSTEM SHALL accept JPEG, PNG, WebP, and HEIC image formats. | Must |
| FR-I06 | WHEN displaying menu items, THE SYSTEM SHALL load images from the Menu Editor backend via HTTP. | Must |
| FR-I07 | WHEN a menu item is updated with a new image (different `image_path`), THE SYSTEM SHALL delete the previous image file from the server. | Should |
| FR-I08 | WHEN a menu item is deleted, THE SYSTEM SHALL delete its associated image file from the server. | Should |

### 2.4 Facts Management

| ID | Requirement | Priority |
|----|------------|----------|
| FR-F01 | WHEN a user navigates to the Facts tab, THE SYSTEM SHALL display all facts from `facts.json`. | Must |
| FR-F02 | WHEN a user taps a fact entry, THE SYSTEM SHALL open an edit form for that fact. | Must |
| FR-F03 | WHEN a user taps the "Add Fact" button, THE SYSTEM SHALL open a blank fact form. | Must |
| FR-F04 | WHEN a user submits a fact form, THE SYSTEM SHALL validate required fields (topic, content) before saving. | Must |
| FR-F05 | WHEN a user saves a fact, THE SYSTEM SHALL persist the change to `facts.json` on the Menu Editor backend. | Must |
| FR-F06 | WHEN a user deletes a fact, THE SYSTEM SHALL show a confirmation dialog before removing it. | Must |
| FR-F07 | WHEN a user types in the facts search field, THE SYSTEM SHALL filter facts by topic or content. | Should |

### 2.5 Facts Data Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fact_id` | string | Yes | Unique identifier (auto-generated UUID) |
| `topic` | string | Yes | Fact title/heading |
| `content` | string | Yes | Fact body text |
| `type` | string | No | Category type (default: `general_info`) |

Supported fact types: `general_info`, `promotion`, `announcement`, `hours`, `policy`.

### 2.6 Authentication

| ID | Requirement | Priority |
|----|------------|----------|
| FR-A01 | WHEN a user opens the app without a valid token, THE SYSTEM SHALL display the login screen. | Must |
| FR-A02 | WHEN a user submits valid credentials, THE SYSTEM SHALL issue a JWT token and navigate to the main screen. | Must |
| FR-A03 | WHEN a user submits invalid credentials, THE SYSTEM SHALL display an error message without revealing whether the username or password was incorrect. | Must |
| FR-A04 | WHEN a user taps "Sign Out" in Settings, THE SYSTEM SHALL clear the stored token and return to the login screen. | Must |
| FR-A05 | WHEN a user selects "Change Password" in Settings, THE SYSTEM SHALL require the current password and a new password before updating. | Must |
| FR-A06 | WHEN a JWT token expires or is rejected (401 response), THE SYSTEM SHALL clear the token and redirect to the login screen. | Must |
| FR-A07 | WHEN the admin account still uses the default password, THE SYSTEM SHALL prompt the user to change it after login. | Should |
| FR-A08 | IF a user exceeds the configured login attempt limit, THEN THE SYSTEM SHALL temporarily block further attempts and display a rate-limit message. | Could |

### 2.7 Server Connection

| ID | Requirement | Priority |
|----|------------|----------|
| FR-S01 | WHEN the app launches, THE SYSTEM SHALL attempt to connect to the configured Menu Editor backend. | Must |
| FR-S02 | WHEN connection fails, THE SYSTEM SHALL display a clear error with a settings option to reconfigure the host. | Must |
| FR-S03 | WHEN a user opens Settings, THE SYSTEM SHALL allow entering the backend host address (IP:port). | Must |
| FR-S04 | WHEN a user saves a new server host, THE SYSTEM SHALL persist it locally and test connectivity. | Must |
| FR-S05 | THE SYSTEM SHALL store the server host in device storage (AsyncStorage) and restore it on launch. | Must |

### 2.8 Data Publishing (Export to Consumers)

| ID | Requirement | Priority |
|----|------------|----------|
| FR-P01 | THE SYSTEM SHALL provide an API endpoint to export the current `menu.json`, `facts.json`, and all referenced images as a ZIP package. | Must |
| FR-P02 | THE SYSTEM SHALL provide read-only API endpoints (`GET /api/v1/locations/{loc_id}/menu`, `GET /api/v1/locations/{loc_id}/menu/facts`) that any consumer application can call to fetch current data for a given location. | Must |
| FR-P03 | THE SYSTEM SHALL serve images at stable HTTP URLs so consumer applications can reference them directly. | Must |
| FR-P03a | THE SYSTEM SHALL provide a public (no auth) endpoint to list available location IDs and names so consumer applications can discover valid locations. | Should |
| FR-P04 | WHEN a user taps "Publish" in Settings, THE SYSTEM SHALL push updated data files to configured consumer target directories via file copy or API call. | Should |
| FR-P05 | THE SYSTEM SHALL support configuring zero or more publish targets (e.g., a local directory path or a remote API endpoint). | Should |
| FR-P06 | WHEN data is published, THE SYSTEM SHALL notify the user of success or failure for each target. | Should |
| FR-P07 | THE SYSTEM SHALL expose a change notification mechanism (webhook callback or version endpoint) that consumer applications can use to detect updates. | Could |

### 2.9 Data Synchronization

| ID | Requirement | Priority |
|----|------------|----------|
| FR-D01 | WHEN a user saves any change, THE SYSTEM SHALL send the update to the Menu Editor backend API immediately. | Must |
| FR-D02 | WHEN a save operation fails, THE SYSTEM SHALL display an error and retain the user's edits for retry. | Must |
| FR-D03 | WHEN a user pulls down on a list, THE SYSTEM SHALL refresh data from the server. | Should |
| FR-D04 | WHEN the app returns to the foreground, THE SYSTEM SHALL refresh data from the server. | Should |
| FR-D05 | IF the server is unreachable, THEN THE SYSTEM SHALL allow browsing cached data in read-only mode. | Could |

### 2.10 Data Management (Settings)

| ID | Requirement | Priority |
|----|------------|----------|
| FR-DM01 | WHEN a user navigates to Settings, THE SYSTEM SHALL display a data summary showing the number of menu items, facts, and the current data version hash. | Should |
| FR-DM02 | WHEN a user taps "Force Refresh All Data" in Settings, THE SYSTEM SHALL reload all data from the server. | Should |
| FR-DM03 | WHEN a user taps "Export ZIP Package" in Settings, THE SYSTEM SHALL download a ZIP export of all menu data and images via the backend API. | Should |

### 2.11 Location Management

| ID | Requirement | Priority |
|----|------------|----------|
| FR-L01 | THE SYSTEM SHALL support managing multiple restaurant locations, each with its own independent menu data set (menu items, facts, and images). | Must |
| FR-L02 | WHEN a user logs in, THE SYSTEM SHALL display a location picker showing all configured locations before navigating to the main screen. | Must |
| FR-L03 | WHEN a user selects a location, THE SYSTEM SHALL load that location's menu data and set it as the active location for all subsequent operations. | Must |
| FR-L04 | WHILE a location is active, THE SYSTEM SHALL display the location name in the app header so the user always knows which location they are editing. | Must |
| FR-L05 | WHEN a user taps the location name in the header, THE SYSTEM SHALL allow switching to a different location. | Must |
| FR-L06 | WHEN an admin adds a new location via Settings, THE SYSTEM SHALL create a new location record and initialize an empty data directory on the backend. | Must |
| FR-L07 | WHEN an admin edits a location in Settings, THE SYSTEM SHALL allow updating the location name and address. Deploy targets are managed by editing `data/locations.json` on the server. | Should |
| FR-L08 | WHEN a user deploys a location's data, THE SYSTEM SHALL push that location's menu.json, facts.json, and images to the location's configured publish targets. | Must |
| FR-L09 | THE SYSTEM SHALL allow each location to have different prices, menu items, and facts independent of other locations. | Must |
| FR-L10 | WHEN displaying the location picker, THE SYSTEM SHALL show a summary for each location (item count, last deployed date). | Should |

### 2.12 Location Data Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `location_id` | string | Yes | Unique identifier (auto-generated slug from name; immutable) |
| `name` | string | Yes | Display name (e.g., "Garden Grove", "Westminster") |
| `address` | string | No | Street address |
| `deploy_targets` | array | No | Per-location deploy target configurations (managed via `locations.json` file on server) |
| `created_at` | string | Yes | ISO 8601 creation timestamp |
| `last_deployed_at` | string | No | ISO 8601 timestamp of last deploy, null if never deployed |

---

## 3. Non-Functional Requirements

### 3.1 Performance

| ID | Requirement |
|----|------------|
| NFR-P01 | THE SYSTEM SHALL load the menu list within 3 seconds on a LAN connection. |
| NFR-P02 | THE SYSTEM SHALL display image previews within 2 seconds of capture. |
| NFR-P03 | THE SYSTEM SHALL upload and process images within 5 seconds for files under 10MB. |

### 3.2 Usability

| ID | Requirement |
|----|------------|
| NFR-U01 | THE SYSTEM SHALL use touch targets of at least 44px for all interactive elements. |
| NFR-U02 | THE SYSTEM SHALL provide toast notifications for all save/delete operations. |
| NFR-U03 | THE SYSTEM SHALL support both portrait and landscape orientations. |
| NFR-U04 | THE SYSTEM SHALL follow the GAC brand color palette and typography. |

### 3.3 Reliability

| ID | Requirement |
|----|------------|
| NFR-R01 | WHEN saving to `menu.json`, THE SYSTEM SHALL create a backup (`menu.json.bak`) before writing. |
| NFR-R02 | WHEN saving to `facts.json`, THE SYSTEM SHALL create a backup (`facts.json.bak`) before writing. |
| NFR-R03 | IF a write operation fails, THEN THE SYSTEM SHALL restore from backup automatically. |
| NFR-R04 | THE SYSTEM SHALL log all write operations and errors to a rotating log file for diagnostics. |

### 3.4 Security

| ID | Requirement |
|----|------------|
| NFR-S01 | THE SYSTEM SHALL require authentication before allowing any data modifications. |
| NFR-S02 | THE SYSTEM SHALL use JWT tokens for API authentication with configurable expiration. |
| NFR-S03 | THE SYSTEM SHALL store tokens securely using platform-appropriate secure storage. |
| NFR-S04 | THE SYSTEM SHALL validate all input on both client and server to prevent injection. |
| NFR-S05 | THE SYSTEM SHOULD enforce rate limiting on the login endpoint to mitigate brute-force attempts (LAN-only; low risk). |
| NFR-S06 | THE SYSTEM SHALL persist the JWT signing secret across server restarts to avoid invalidating active sessions. |
| NFR-S07 | THE SYSTEM SHALL configure CORS to allow all origins (`*`) for LAN access. |

### 3.5 Compatibility

| ID | Requirement |
|----|------------|
| NFR-C01 | THE SYSTEM SHALL target Expo SDK 54+ (React Native 0.81+). |
| NFR-C02 | THE SYSTEM SHALL support Android 10+ and iOS 15+. |
| NFR-C03 | THE SYSTEM SHALL produce `menu.json` and `facts.json` files conforming to the documented schema, consumable by any downstream application. Each file SHALL include a top-level `schema_version` field (initial value: `"1.0"`) to support backward-compatible evolution. |
| NFR-C04 | THE SYSTEM SHALL use standard image directory conventions (`images/`, `downloaded_images/`, `uploaded_images/`) within its own data directory. |

### 3.6 Deployability

| ID | Requirement |
|----|------------|
| NFR-D02 | THE SYSTEM SHALL include backend API tests (pytest) covering authentication, CRUD operations, image processing, and deploy endpoints. |
| NFR-D03 | THE SYSTEM SHALL include mobile component tests (Jest) covering form validation, API service calls, and navigation flows. |

---

## 4. Constraints

| Constraint | Description |
|------------|-------------|
| C01 | The `menu.json` and `facts.json` schemas are the public contracts between the editor and consumer applications; schema changes must be versioned and backward-compatible. A `schema_version` field in each JSON file identifies the current schema revision. |
| C02 | The Menu Editor backend runs on a LAN server (default port `8100` to avoid conflicts with consumer applications); the mobile app must support configurable host. |
| C03 | The Menu Editor owns its own data directory; each location's data is isolated in a subdirectory. Consumer applications receive data via export, read-only API, or publish mechanism — never by direct writes to the editor's data. |
| C04 | Single concurrent editor assumption — no multi-user conflict resolution required. |
| C05 | Expo Go development workflow required for rapid iteration on both platforms. |
| C06 | Each location's data is fully independent — no shared items or cross-location references. Edits to one location never affect another. |

---

## 5. Assumptions

| Assumption | Description |
|------------|-------------|
| A01 | The Menu Editor runs its own independent backend process. |
| A02 | Consumer applications (e.g., GAC-Concierge) will adapt to pull or receive data from the editor's API or published export. |
| A03 | The user has basic smartphone proficiency (camera, text input, navigation). |
| A04 | Restaurant has Wi-Fi connectivity for LAN communication. |
| A05 | Consumer applications are responsible for their own cache/index rebuilding when they receive updated data. |

---

## 6. Out of Scope

| Item | Rationale |
|------|-----------|
| Multi-user editing with conflict resolution | Single editor assumption (C04) |
| Offline-first with full sync | LAN-connected use case; minimal offline browsing only |
| Menu ordering / customer-facing features | Handled by consumer applications, not the editor |
| Restaurant POS integration | Future consideration |
| Multi-restaurant support | ~~Single-restaurant deployment~~ **Now supported** — see §2.11 Location Management |
| Audit trail / change history | Not required for initial release |
| Consumer application logic (AI agents, RAG, TTS, ordering) | Owned entirely by consumer applications |
