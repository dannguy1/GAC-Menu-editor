"""Location CRUD tests for the GAC Menu Editor backend.

Tests FR-L01-L10, FR-P03a, NFR-D02.
"""


def test_create_location(client, auth_headers):
    """FR-L01, FR-L06: Create a location with auto-generated slug."""
    resp = client.post(
        "/api/v1/locations",
        json={"name": "Garden Grove", "address": "9892 Westminster Ave"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["location"]["location_id"] == "garden-grove"
    assert data["location"]["name"] == "Garden Grove"
    assert data["message"] == "Location created"


def test_create_location_creates_directory(client, auth_headers, tmp_path):
    """FR-L06: Creating a location initializes the data directory."""
    import config
    resp = client.post(
        "/api/v1/locations",
        json={"name": "Westminster"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    loc_id = resp.json()["location"]["location_id"]
    loc_dir = f"{config.settings.DATA_DIR}/locations/{loc_id}"
    import os
    assert os.path.isdir(loc_dir)
    assert os.path.exists(f"{loc_dir}/menu.json")
    assert os.path.exists(f"{loc_dir}/facts.json")
    assert os.path.isdir(f"{loc_dir}/uploaded_images")


def test_create_location_slug_generation(client, auth_headers):
    """Slug from name: lowercase, hyphens, stripped."""
    resp = client.post(
        "/api/v1/locations",
        json={"name": "Fountain Valley"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["location"]["location_id"] == "fountain-valley"


def test_create_duplicate_location_returns_409(client, auth_headers):
    """Duplicate location name/id returns 409."""
    client.post("/api/v1/locations", json={"name": "Westminster"}, headers=auth_headers)
    resp = client.post("/api/v1/locations", json={"name": "Westminster"}, headers=auth_headers)
    assert resp.status_code == 409


def test_list_locations_with_auth_returns_full_details(client, auth_headers):
    """FR-L10: Authenticated list includes counts and deploy status."""
    client.post("/api/v1/locations", json={"name": "Garden Grove"}, headers=auth_headers)
    resp = client.get("/api/v1/locations", headers=auth_headers)
    assert resp.status_code == 200
    locations = resp.json()["locations"]
    assert len(locations) == 1
    loc = locations[0]
    assert "item_count" in loc
    assert "fact_count" in loc
    assert "address" in loc
    assert "created_at" in loc


def test_list_locations_without_auth_returns_slim(client, auth_headers):
    """FR-P03a: Unauthenticated list returns only location_id and name."""
    client.post("/api/v1/locations", json={"name": "Garden Grove"}, headers=auth_headers)
    resp = client.get("/api/v1/locations")
    assert resp.status_code == 200
    locations = resp.json()["locations"]
    assert len(locations) == 1
    loc = locations[0]
    assert "location_id" in loc
    assert "name" in loc
    assert "item_count" not in loc
    assert "address" not in loc


def test_update_location(client, auth_headers, test_location):
    """FR-L07: Update location name and address."""
    resp = client.put(
        f"/api/v1/locations/{test_location}",
        json={"name": "Updated Name", "address": "456 New St"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["location"]["name"] == "Updated Name"
    assert resp.json()["location"]["address"] == "456 New St"


def test_update_nonexistent_location_returns_404(client, auth_headers):
    resp = client.put(
        "/api/v1/locations/nonexistent",
        json={"name": "New Name"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_delete_location(client, auth_headers):
    """FR-L01: Delete location removes directory."""
    import os, config
    client.post("/api/v1/locations", json={"name": "To Delete"}, headers=auth_headers)
    loc_id = "to-delete"
    loc_dir = f"{config.settings.DATA_DIR}/locations/{loc_id}"
    assert os.path.isdir(loc_dir)

    resp = client.delete(f"/api/v1/locations/{loc_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["message"] == "Location deleted"
    assert not os.path.exists(loc_dir)


def test_delete_nonexistent_location_returns_404(client, auth_headers):
    resp = client.delete("/api/v1/locations/nonexistent", headers=auth_headers)
    assert resp.status_code == 404


def test_invalid_location_on_items_returns_404(client, auth_headers):
    resp = client.get("/api/v1/locations/nonexistent/items", headers=auth_headers)
    assert resp.status_code == 404


def test_locations_requires_auth_for_create(client):
    resp = client.post("/api/v1/locations", json={"name": "Test"})
    assert resp.status_code == 401
