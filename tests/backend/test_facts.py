"""Facts CRUD tests for the GAC Menu Editor backend.

Tests FR-F01-F07, NFR-D02.
"""
import re


def test_create_fact(client, auth_headers, test_location, sample_fact):
    resp = client.post(
        f"/api/v1/locations/{test_location}/facts",
        json=sample_fact,
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "fact_id" in data["fact"]
    assert data["fact"]["topic"] == "Restaurant Overview"
    assert data["fact"]["type"] == "general_info"
    assert data["message"] == "Fact created"


def test_fact_id_is_uuid(client, auth_headers, test_location, sample_fact):
    resp = client.post(
        f"/api/v1/locations/{test_location}/facts",
        json=sample_fact,
        headers=auth_headers,
    )
    fact_id = resp.json()["fact"]["fact_id"]
    uuid_pattern = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    assert re.match(uuid_pattern, fact_id)


def test_list_facts(client, auth_headers, test_location, sample_fact):
    client.post(f"/api/v1/locations/{test_location}/facts", json=sample_fact, headers=auth_headers)
    resp = client.get(f"/api/v1/locations/{test_location}/facts", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["facts"][0]["topic"] == "Restaurant Overview"


def test_update_fact(client, auth_headers, test_location, sample_fact):
    create_resp = client.post(
        f"/api/v1/locations/{test_location}/facts",
        json=sample_fact,
        headers=auth_headers,
    )
    fact_id = create_resp.json()["fact"]["fact_id"]

    resp = client.put(
        f"/api/v1/locations/{test_location}/facts/{fact_id}",
        json={"topic": "Updated Topic", "content": "Updated content"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["fact"]["topic"] == "Updated Topic"
    assert resp.json()["fact"]["content"] == "Updated content"


def test_update_nonexistent_fact_returns_404(client, auth_headers, test_location):
    resp = client.put(
        f"/api/v1/locations/{test_location}/facts/nonexistent-uuid",
        json={"topic": "test"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_delete_fact(client, auth_headers, test_location, sample_fact):
    create_resp = client.post(
        f"/api/v1/locations/{test_location}/facts",
        json=sample_fact,
        headers=auth_headers,
    )
    fact_id = create_resp.json()["fact"]["fact_id"]

    resp = client.delete(
        f"/api/v1/locations/{test_location}/facts/{fact_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "Fact deleted"

    list_resp = client.get(f"/api/v1/locations/{test_location}/facts", headers=auth_headers)
    assert list_resp.json()["total"] == 0


def test_delete_nonexistent_fact_returns_404(client, auth_headers, test_location):
    resp = client.delete(
        f"/api/v1/locations/{test_location}/facts/nonexistent-uuid",
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_invalid_location_returns_404(client, auth_headers):
    resp = client.get("/api/v1/locations/nonexistent/facts", headers=auth_headers)
    assert resp.status_code == 404


def test_facts_require_auth(client, test_location):
    resp = client.get(f"/api/v1/locations/{test_location}/facts")
    assert resp.status_code == 401


def test_invalid_fact_type_rejected(client, auth_headers, test_location):
    resp = client.post(
        f"/api/v1/locations/{test_location}/facts",
        json={"topic": "Test", "content": "Content", "type": "invalid_type"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_valid_fact_types(client, auth_headers, test_location):
    for fact_type in ["general_info", "promotion", "announcement", "hours", "policy"]:
        resp = client.post(
            f"/api/v1/locations/{test_location}/facts",
            json={"topic": f"Test {fact_type}", "content": "Content", "type": fact_type},
            headers=auth_headers,
        )
        assert resp.status_code == 200, f"Failed for type: {fact_type}"


def test_backup_created_on_fact_write(client, auth_headers, test_location, sample_fact):
    """NFR-R02: Backup created before facts.json write."""
    import os, config
    client.post(f"/api/v1/locations/{test_location}/facts", json=sample_fact, headers=auth_headers)
    backup_path = f"{config.settings.DATA_DIR}/locations/{test_location}/facts.json.bak"
    assert os.path.exists(backup_path)


def test_public_facts_endpoint(client, auth_headers, test_location, sample_fact):
    """FR-P02: Public read-only facts endpoint with schema_version."""
    client.post(f"/api/v1/locations/{test_location}/facts", json=sample_fact, headers=auth_headers)
    resp = client.get(f"/api/v1/locations/{test_location}/menu/facts")
    assert resp.status_code == 200
    data = resp.json()
    assert "schema_version" in data
    assert data["schema_version"] == "1.0"
    assert len(data["facts"]) == 1
