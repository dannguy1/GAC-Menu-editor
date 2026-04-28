"""Deploy tests for the GAC Menu Editor backend.

Tests FR-P04, NFR-D02.
"""
import json
import os


def test_deploy_no_targets(client, auth_headers, test_location):
    """Deploy with no configured targets returns empty results."""
    resp = client.post(
        f"/api/v1/locations/{test_location}/deploy",
        json={},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["results"] == []


def test_deploy_updates_last_deployed_at(client, auth_headers, test_location):
    """Deploy updates last_deployed_at timestamp."""
    # Verify initially null
    locs_before = client.get("/api/v1/locations", headers=auth_headers).json()["locations"]
    loc_before = next(l for l in locs_before if l["location_id"] == test_location)
    assert loc_before["last_deployed_at"] is None

    client.post(f"/api/v1/locations/{test_location}/deploy", json={}, headers=auth_headers)

    locs_after = client.get("/api/v1/locations", headers=auth_headers).json()["locations"]
    loc_after = next(l for l in locs_after if l["location_id"] == test_location)
    assert loc_after["last_deployed_at"] is not None


def test_deploy_file_copy_target(client, auth_headers, test_location, tmp_path):
    """FR-P04: File copy target copies menu/facts to target directory."""
    import config

    target_dir = tmp_path / "consumer_data"
    target_dir.mkdir()

    # Manually configure a deploy target in locations.json
    locs_file = config.settings.LOCATIONS_FILE
    with open(locs_file) as f:
        data = json.load(f)
    for i, loc in enumerate(data["locations"]):
        if loc["location_id"] == test_location:
            data["locations"][i]["deploy_targets"] = [
                {
                    "name": "Test Consumer",
                    "type": "file_copy",
                    "path": str(target_dir),
                    "include_images": False,
                }
            ]
    with open(locs_file, "w") as f:
        json.dump(data, f)

    # Add an item to give the menu some content
    client.post(
        f"/api/v1/locations/{test_location}/items",
        json={"item_name": "Deploy Test Item", "price": 10.0, "category": "Test", "description": "Test"},
        headers=auth_headers,
    )

    resp = client.post(
        f"/api/v1/locations/{test_location}/deploy",
        json={},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 1
    assert results[0]["status"] == "success"

    assert os.path.exists(str(target_dir / "menu.json"))
    assert os.path.exists(str(target_dir / "facts.json"))

    with open(str(target_dir / "menu.json")) as f:
        deployed_menu = json.load(f)
    assert len(deployed_menu["items"]) == 1


def test_deploy_invalid_location_returns_404(client, auth_headers):
    resp = client.post(
        "/api/v1/locations/nonexistent/deploy",
        json={},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_deploy_requires_auth(client, test_location):
    resp = client.post(f"/api/v1/locations/{test_location}/deploy", json={})
    assert resp.status_code == 401


def test_export_zip(client, auth_headers, test_location):
    """FR-P01: Export ZIP contains menu.json and facts.json."""
    # Add some data
    client.post(
        f"/api/v1/locations/{test_location}/items",
        json={"item_name": "Export Item", "price": 10.0, "category": "Test", "description": "Test"},
        headers=auth_headers,
    )
    resp = client.get(f"/api/v1/locations/{test_location}/export", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/zip"

    import io, zipfile
    buf = io.BytesIO(resp.content)
    with zipfile.ZipFile(buf) as zf:
        names = zf.namelist()
    assert "menu.json" in names
    assert "facts.json" in names


def test_export_requires_auth(client, test_location):
    resp = client.get(f"/api/v1/locations/{test_location}/export")
    assert resp.status_code == 401


def test_public_menu_endpoint(client, auth_headers, test_location):
    """FR-P02, NFR-C03: Public menu endpoint returns schema_version."""
    client.post(
        f"/api/v1/locations/{test_location}/items",
        json={"item_name": "Public Item", "price": 10.0, "category": "Test", "description": "Test"},
        headers=auth_headers,
    )
    resp = client.get(f"/api/v1/locations/{test_location}/menu")
    assert resp.status_code == 200
    data = resp.json()
    assert data["schema_version"] == "1.0"
    assert len(data["items"]) == 1


def test_version_endpoint(client, auth_headers, test_location):
    """Version endpoint returns hashes."""
    resp = client.get(f"/api/v1/locations/{test_location}/version")
    assert resp.status_code == 200
    data = resp.json()
    assert "menu_hash" in data
    assert "facts_hash" in data
