---
description: "Use when writing or running tests. Covers pytest patterns for the backend API and Jest patterns for the mobile app. Includes test fixtures, mocking strategies, and coverage expectations."
applyTo: "tests/**"
---

# Testing Guidelines

## Backend Tests (pytest)

Location: `tests/backend/`

### Running
```bash
cd backend
pytest ../tests/backend/ -v
pytest ../tests/backend/ -v --cov=. --cov-report=term-missing
```

### Fixtures (conftest.py)
```python
import pytest
from fastapi.testclient import TestClient
from main import app

@pytest.fixture
def client(tmp_path):
    # Override DATA_DIR to use temp directory
    # Create locations subdirectory and empty locations.json
    app.state.data_dir = str(tmp_path)
    (tmp_path / "locations").mkdir()
    return TestClient(app)

@pytest.fixture
def test_location(client, auth_headers):
    resp = client.post("/api/v1/locations", json={"name": "Test Location"}, headers=auth_headers)
    return resp.json()["location"]["location_id"]

@pytest.fixture
def auth_token(client):
    resp = client.post("/api/v1/auth/token", json={"username": "admin", "password": "changeme123"})
    return resp.json()["access_token"]

@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}
```

### Test Patterns
```python
def test_create_item(client, auth_headers, test_location):
    item = {"item_name": "Test Dish", "price": 12.50, "category": "Appetizers", "description": "A test dish"}
    resp = client.post(f"/api/v1/locations/{test_location}/items", json=item, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["item"]["item_id"] == "test-dish"

def test_create_item_unauthorized(client, test_location):
    resp = client.post(f"/api/v1/locations/{test_location}/items", json={...})
    assert resp.status_code == 401

def test_invalid_location(client, auth_headers):
    resp = client.get("/api/v1/locations/nonexistent/items", headers=auth_headers)
    assert resp.status_code == 404

def test_read_only_no_auth(client, test_location):
    resp = client.get(f"/api/v1/locations/{test_location}/menu")
    assert resp.status_code == 200
    assert "schema_version" in resp.json()
```

### Coverage Expectations
- All CRUD operations: success and error paths
- Location management: create, list, delete, duplicate prevention
- Authentication: valid/invalid/expired tokens
- Data isolation: items in location A not visible in location B
- Input validation: missing fields, invalid types, boundary values
- Backup: verify .bak created before writes
- Image: valid/invalid types, size limits

## Mobile Tests (Jest)

Location: `tests/mobile/`

### Running
```bash
cd mobile
npm test
npm test -- --coverage
```

### Test Patterns
```javascript
// api.test.js
import { getItems } from '../services/api';

global.fetch = jest.fn();

test('getItems sends auth header', async () => {
  fetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => ({ items: [] }) });
  await getItems('test-token', 'garden-grove');
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/v1/locations/garden-grove/items'),
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) })
  );
});
```

### Coverage Expectations
- API service: all functions construct correct requests
- Components: render with props, handle user interactions
- Form validation: required fields, price constraints
