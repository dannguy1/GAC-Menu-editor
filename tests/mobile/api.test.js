/**
 * API service tests.
 * Tests FR-S01, FR-D01, NFR-D03 — all API functions construct correct location-scoped requests.
 */

import {
  login,
  getLocations,
  getItems,
  getCategories,
  createItem,
  updateItem,
  deleteItem,
  getFacts,
  createFact,
  updateFact,
  deleteFact,
  deploy,
  getVersion,
  setServerHost,
  AuthError,
} from '../../mobile/services/api';

const TOKEN = 'test-jwt-token';
const LOCATION_ID = 'garden-grove';

// Mock fetch globally
global.fetch = jest.fn();

beforeEach(() => {
  fetch.mockClear();
  setServerHost('http://192.168.10.3:8100');
});

function mockOk(body) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

function mock401() {
  return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ detail: 'Unauthorized' }) });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

test('login sends credentials to /auth/token', async () => {
  fetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ access_token: 'tok', token_type: 'bearer', password_is_default: false }) });
  const result = await login('http://192.168.10.3:8100', 'admin', 'changeme123');
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/v1/auth/token'),
    expect.objectContaining({ method: 'POST' })
  );
  expect(result.access_token).toBe('tok');
});

test('login throws AuthError on 401', async () => {
  fetch.mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({ detail: 'Invalid' }) });
  await expect(login('http://192.168.10.3:8100', 'admin', 'wrong')).rejects.toBeInstanceOf(AuthError);
});

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

test('getLocations sends auth header', async () => {
  fetch.mockResolvedValueOnce(mockOk({ locations: [] }));
  await getLocations(TOKEN);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/v1/locations'),
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }) })
  );
});

test('getLocations throws AuthError on 401', async () => {
  fetch.mockResolvedValueOnce(mock401());
  await expect(getLocations(TOKEN)).rejects.toBeInstanceOf(AuthError);
});

// ---------------------------------------------------------------------------
// Items (location-scoped)
// ---------------------------------------------------------------------------

test('getItems constructs location-scoped URL', async () => {
  fetch.mockResolvedValueOnce(mockOk({ items: [], total: 0 }));
  await getItems(TOKEN, LOCATION_ID);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining(`/api/v1/locations/${LOCATION_ID}/items`),
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }) })
  );
});

test('getItems appends search and category query params', async () => {
  fetch.mockResolvedValueOnce(mockOk({ items: [], total: 0 }));
  await getItems(TOKEN, LOCATION_ID, 'honey', 'Seafood');
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('search=honey'),
    expect.anything()
  );
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('category=Seafood'),
    expect.anything()
  );
});

test('createItem posts to location-scoped endpoint', async () => {
  const item = { item_name: 'Test', price: 10, category: 'Seafood', description: 'Test' };
  fetch.mockResolvedValueOnce(mockOk({ item: { ...item, item_id: 'test' }, message: 'Item created' }));
  await createItem(TOKEN, LOCATION_ID, item);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining(`/api/v1/locations/${LOCATION_ID}/items`),
    expect.objectContaining({ method: 'POST' })
  );
});

test('updateItem sends PUT to location-scoped endpoint with item_id', async () => {
  const itemId = 'test-dish';
  fetch.mockResolvedValueOnce(mockOk({ item: {}, message: 'Item updated' }));
  await updateItem(TOKEN, LOCATION_ID, itemId, { price: 15 });
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining(`/api/v1/locations/${LOCATION_ID}/items/${itemId}`),
    expect.objectContaining({ method: 'PUT' })
  );
});

test('deleteItem sends DELETE to location-scoped endpoint', async () => {
  const itemId = 'test-dish';
  fetch.mockResolvedValueOnce(mockOk({ message: 'Item deleted' }));
  await deleteItem(TOKEN, LOCATION_ID, itemId);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining(`/api/v1/locations/${LOCATION_ID}/items/${itemId}`),
    expect.objectContaining({ method: 'DELETE' })
  );
});

// ---------------------------------------------------------------------------
// Facts (location-scoped)
// ---------------------------------------------------------------------------

test('getFacts constructs location-scoped URL', async () => {
  fetch.mockResolvedValueOnce(mockOk({ facts: [], total: 0 }));
  await getFacts(TOKEN, LOCATION_ID);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining(`/api/v1/locations/${LOCATION_ID}/facts`),
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }) })
  );
});

test('createFact posts to location-scoped endpoint', async () => {
  const fact = { topic: 'Test', content: 'Content', type: 'general_info' };
  fetch.mockResolvedValueOnce(mockOk({ fact: { ...fact, fact_id: 'uuid' }, message: 'Fact created' }));
  await createFact(TOKEN, LOCATION_ID, fact);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining(`/api/v1/locations/${LOCATION_ID}/facts`),
    expect.objectContaining({ method: 'POST' })
  );
});

test('updateFact sends PUT with fact_id in URL', async () => {
  const factId = 'some-uuid-1234';
  fetch.mockResolvedValueOnce(mockOk({ fact: {}, message: 'Fact updated' }));
  await updateFact(TOKEN, LOCATION_ID, factId, { topic: 'Updated' });
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining(`/api/v1/locations/${LOCATION_ID}/facts/${factId}`),
    expect.objectContaining({ method: 'PUT' })
  );
});

test('deleteFact sends DELETE with fact_id in URL', async () => {
  const factId = 'some-uuid-1234';
  fetch.mockResolvedValueOnce(mockOk({ message: 'Fact deleted' }));
  await deleteFact(TOKEN, LOCATION_ID, factId);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining(`/api/v1/locations/${LOCATION_ID}/facts/${factId}`),
    expect.objectContaining({ method: 'DELETE' })
  );
});

// ---------------------------------------------------------------------------
// Deploy / Export
// ---------------------------------------------------------------------------

test('deploy posts to location-scoped deploy endpoint', async () => {
  fetch.mockResolvedValueOnce(mockOk({ results: [] }));
  await deploy(TOKEN, LOCATION_ID);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining(`/api/v1/locations/${LOCATION_ID}/deploy`),
    expect.objectContaining({ method: 'POST' })
  );
});

test('getVersion hits version endpoint', async () => {
  fetch.mockResolvedValueOnce(mockOk({ menu_hash: 'abc', facts_hash: 'def', last_modified: null }));
  await getVersion(TOKEN, LOCATION_ID);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining(`/api/v1/locations/${LOCATION_ID}/version`),
    expect.anything()
  );
});
