/**
 * API service layer — all backend calls centralized here.
 * Base URL from configured server host. Token header injection.
 * Implements FR-S01, FR-D01.
 */

const DEFAULT_TIMEOUT = 10000;

class AuthError extends Error {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthError';
  }
}

let _serverHost = 'http://192.168.10.3:8100';

export function setServerHost(host) {
  _serverHost = host.replace(/\/$/, '');
}

export function getServerHost() {
  return _serverHost;
}

function baseUrl() {
  return `${_serverHost}/api/v1`;
}

async function request(method, path, { token, body, isFormData = false } = {}) {
  const url = `${baseUrl()}${path}`;
  const headers = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (body && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const options = {
    method,
    headers,
  };
  if (body) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  options.signal = controller.signal;

  try {
    const resp = await fetch(url, options);
    clearTimeout(timeoutId);

    if (resp.status === 401) {
      throw new AuthError('Session expired. Please sign in again.');
    }

    return resp;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AuthError') throw err;
    if (err.name === 'AbortError') throw new Error('Request timed out');
    throw err;
  }
}

async function json(method, path, opts = {}) {
  const resp = await request(method, path, opts);
  if (!resp.ok) {
    let message = `HTTP ${resp.status}`;
    try {
      const data = await resp.json();
      message = data.detail || message;
    } catch (_) {}
    throw new Error(message);
  }
  return resp.json();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function login(serverHost, username, password) {
  setServerHost(serverHost);
  const resp = await request('POST', '/auth/token', {
    body: { username, password },
  });
  if (resp.status === 401) throw new Error('Invalid credentials');
  if (!resp.ok) throw new Error(`Login failed: HTTP ${resp.status}`);
  return resp.json();
}

export async function changePassword(token, currentPassword, newPassword) {
  return json('PUT', '/auth/password', {
    token,
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export async function getLocations(token) {
  return json('GET', '/locations', { token });
}

export async function createLocation(token, name, address) {
  return json('POST', '/locations', { token, body: { name, address } });
}

export async function updateLocation(token, locationId, name, address) {
  return json('PUT', `/locations/${locationId}`, { token, body: { name, address } });
}

export async function deleteLocation(token, locationId) {
  return json('DELETE', `/locations/${locationId}`, { token });
}

// ---------------------------------------------------------------------------
// Menu Items (location-scoped)
// ---------------------------------------------------------------------------

export async function getItems(token, locationId, search = '', category = '') {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return json('GET', `/locations/${locationId}/items${qs}`, { token });
}

export async function getCategories(token, locationId) {
  return json('GET', `/locations/${locationId}/items/categories`, { token });
}

export async function createItem(token, locationId, itemData) {
  return json('POST', `/locations/${locationId}/items`, { token, body: itemData });
}

export async function updateItem(token, locationId, itemId, itemData) {
  return json('PUT', `/locations/${locationId}/items/${itemId}`, { token, body: itemData });
}

export async function deleteItem(token, locationId, itemId) {
  return json('DELETE', `/locations/${locationId}/items/${itemId}`, { token });
}

// ---------------------------------------------------------------------------
// Facts (location-scoped)
// ---------------------------------------------------------------------------

export async function getFacts(token, locationId) {
  return json('GET', `/locations/${locationId}/facts`, { token });
}

export async function createFact(token, locationId, factData) {
  return json('POST', `/locations/${locationId}/facts`, { token, body: factData });
}

export async function updateFact(token, locationId, factId, factData) {
  return json('PUT', `/locations/${locationId}/facts/${factId}`, { token, body: factData });
}

export async function deleteFact(token, locationId, factId) {
  return json('DELETE', `/locations/${locationId}/facts/${factId}`, { token });
}

// ---------------------------------------------------------------------------
// Image upload (location-scoped)
// ---------------------------------------------------------------------------

export async function uploadImage(token, locationId, uri, itemName, category) {
  const formData = new FormData();
  const filename = uri.split('/').pop();
  const ext = filename.split('.').pop().toLowerCase();
  const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' };
  const type = mimeMap[ext] || 'image/jpeg';
  formData.append('file', { uri, name: filename, type });
  formData.append('item_name', itemName);
  formData.append('category', category);

  return json('POST', `/locations/${locationId}/upload`, { token, body: formData, isFormData: true });
}

// ---------------------------------------------------------------------------
// Deploy / Export
// ---------------------------------------------------------------------------

export async function deploy(token, locationId) {
  return json('POST', `/locations/${locationId}/deploy`, { token, body: {} });
}

export async function exportZip(token, locationId) {
  const resp = await request('GET', `/locations/${locationId}/export`, { token });
  if (!resp.ok) throw new Error(`Export failed: HTTP ${resp.status}`);
  return resp;
}

export async function getVersion(token, locationId) {
  return json('GET', `/locations/${locationId}/version`, { token });
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export async function testConnection(serverHost) {
  const host = serverHost.replace(/\/$/, '');
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(`${host}/api/v1/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return resp.ok;
  } catch (_) {
    return false;
  }
}

export { AuthError };
