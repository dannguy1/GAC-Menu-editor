"""Pytest fixtures for the GAC Menu Editor backend tests."""
import json
import os
import sys
import pytest
from fastapi.testclient import TestClient

# Disable rate limiting for tests
os.environ["DISABLE_RATE_LIMIT"] = "1"

# Add backend to path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))


@pytest.fixture
def client(tmp_path, monkeypatch):
    """Create a TestClient with isolated temp data directory."""
    # Set up temp data and logs directories
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "locations").mkdir()
    logs_dir = tmp_path / "logs"
    logs_dir.mkdir()

    # Patch settings before importing the app
    import config
    monkeypatch.setattr(config.settings, "DATA_DIR", str(data_dir))
    monkeypatch.setattr(config.settings, "LOCATIONS_FILE", str(data_dir / "locations.json"))
    monkeypatch.setattr(config.settings, "LOG_DIR", str(logs_dir))

    # Re-run first-run init for this test's temp dir
    import main as main_module
    main_module.first_run_init()

    from main import app
    return TestClient(app)


@pytest.fixture
def auth_token(client):
    """Get a valid JWT token for the default admin user."""
    resp = client.post("/api/v1/auth/token", json={"username": "admin", "password": "changeme123"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.fixture
def auth_headers(auth_token):
    """Authorization headers with valid JWT."""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def test_location(client, auth_headers):
    """Create a test location and return its location_id."""
    resp = client.post(
        "/api/v1/locations",
        json={"name": "Test Location", "address": "123 Test St"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    return resp.json()["location"]["location_id"]


@pytest.fixture
def sample_item():
    """Sample menu item data."""
    return {
        "item_name": "Test Dish",
        "price": 12.50,
        "category": "Appetizers",
        "description": "A test dish",
        "popular": False,
        "available": True,
    }


@pytest.fixture
def sample_fact():
    """Sample fact data."""
    return {
        "topic": "Restaurant Overview",
        "content": "Garlic & Chives is a Vietnamese restaurant.",
        "type": "general_info",
    }
