/**
 * Auth service — token storage, server host, last location.
 * Implements NFR-S03, FR-S05, FR-L06.
 */
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'gac_menu_editor_token';
const SERVER_HOST_KEY = 'gac_menu_editor_host';
const LAST_LOCATION_KEY = 'gac_menu_editor_last_location';

// ---------------------------------------------------------------------------
// JWT Token (SecureStore) — NFR-S03
// ---------------------------------------------------------------------------

export async function saveToken(token) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken() {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (_) {
    return null;
  }
}

export async function clearToken() {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Server Host (AsyncStorage) — FR-S05
// ---------------------------------------------------------------------------

export async function saveServerHost(host) {
  await AsyncStorage.setItem(SERVER_HOST_KEY, host);
}

export async function getServerHost() {
  try {
    return await AsyncStorage.getItem(SERVER_HOST_KEY);
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Last Location (AsyncStorage) — FR-L06
// ---------------------------------------------------------------------------

export async function saveLastLocation(locationId) {
  await AsyncStorage.setItem(LAST_LOCATION_KEY, locationId);
}

export async function getLastLocation() {
  try {
    return await AsyncStorage.getItem(LAST_LOCATION_KEY);
  } catch (_) {
    return null;
  }
}

export async function clearLastLocation() {
  try {
    await AsyncStorage.removeItem(LAST_LOCATION_KEY);
  } catch (_) {}
}
