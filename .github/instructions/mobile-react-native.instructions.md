---
description: "Use when writing or editing React Native / Expo mobile code. Covers component patterns, state management, API service layer, navigation, camera/gallery, and secure storage for the Menu Editor mobile app."
applyTo: "mobile/**/*.js"
---

# Mobile React Native / Expo Guidelines

## Architecture

- `App.js` — Root component: auth gate, tab navigation, all primary state
- `screens/` — One file per screen (LoginScreen, LocationPickerScreen, MenuListScreen, MenuEditScreen, etc.)
- `components/` — Reusable UI components (cards, pickers, toasts, dialogs, LocationCard)
- `services/` — API calls (`api.js`), auth/token management (`auth.js`), image helpers (`imageHelper.js`)
- `plugins/` — Expo build plugins (e.g., cleartext traffic)

## State Management

All state lives in `App.js`. No Redux, MobX, or Context API. Pass state and callbacks as props.

```javascript
// App.js — state shape
const [locations, setLocations] = useState([]);
const [activeLocation, setActiveLocation] = useState(null);
const [menuItems, setMenuItems] = useState([]);
const [facts, setFacts] = useState([]);
const [token, setToken] = useState(null);
const [serverHost, setServerHost] = useState('');
const [isConnected, setIsConnected] = useState(false);
// ... see docs/02_System_Design.md §2.2 for full list
```

## Component Patterns

- Functional components with hooks ONLY — no class components
- Use `StyleSheet.create()` at the bottom of each file — no inline style objects
- Minimum touch target: 44x44px for all interactive elements
- Use `KeyboardAvoidingView` on all form screens

```javascript
// Component template
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function MenuItemCard({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(item)}>
      {/* ... */}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0d8c8',
    // ... see docs/03_Branding_Guidelines.md §4.1
  },
});
```

## API Service Layer

All HTTP calls go through `services/api.js`. Never use `fetch()` directly in components/screens.

```javascript
// services/api.js pattern — all data endpoints are location-scoped
const API_BASE = `http://${serverHost}/api/v1`;

export async function getItems(token, locationId, search = '', category = '') {
  const res = await fetch(`${API_BASE}/locations/${locationId}/items?search=${search}&category=${category}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) throw new ApiError(await res.json());
  return res.json();
}
```

## Auth / Token Storage

- Use `expo-secure-store` for JWT tokens (Keychain on iOS, EncryptedSharedPreferences on Android)
- Use `AsyncStorage` for non-sensitive settings (server host only)
- On 401 response: clear token, redirect to LoginScreen
- Never log or display tokens

## Image Handling

- Use `expo-image-picker` for camera and gallery
- Always request permissions before accessing camera/gallery
- Show preview before upload
- Upload via `multipart/form-data` to `POST /api/v1/locations/{location_id}/upload`

```javascript
import * as ImagePicker from 'expo-image-picker';

async function pickImage() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });
  if (!result.canceled) return result.assets[0].uri;
}
```

## Navigation

App flow: Login → Location Picker → Three-tab bottom navigation (Menu, Facts, Settings). Implemented as state in `App.js`, not React Navigation.

```javascript
// Screen rendering in App.js
if (!isAuthenticated) return <LoginScreen ... />;
if (!activeLocation) return <LocationPickerScreen ... />;
{activeTab === 'menu' && <MenuListScreen ... />}
{activeTab === 'facts' && <FactsListScreen ... />}
{activeTab === 'settings' && <SettingsScreen ... />}
```

Header shows active location name. Tapping it returns to LocationPickerScreen.

## Dependencies

See `mobile/package.json`. Key packages:
- `expo` (SDK 54), `expo-image-picker`, `expo-secure-store`
- `@react-native-async-storage/async-storage`
- `@react-native-picker/picker`
