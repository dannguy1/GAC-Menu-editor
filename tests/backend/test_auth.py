"""Authentication tests for the GAC Menu Editor backend.

Tests FR-A01-A07, NFR-D02.
"""


def test_login_success(client):
    resp = client.post("/api/v1/auth/token", json={"username": "admin", "password": "changeme123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["password_is_default"] is True


def test_login_invalid_password(client):
    """FR-A03: Generic error — don't reveal which field was wrong."""
    resp = client.post("/api/v1/auth/token", json={"username": "admin", "password": "wrongpassword"})
    assert resp.status_code == 401
    assert "Invalid credentials" in resp.json()["detail"]


def test_login_invalid_username(client):
    resp = client.post("/api/v1/auth/token", json={"username": "nobody", "password": "changeme123"})
    assert resp.status_code == 401
    assert "Invalid credentials" in resp.json()["detail"]


def test_token_is_valid_for_protected_route(client, auth_headers):
    """Token returned from login works on protected routes."""
    resp = client.get("/api/v1/locations", headers=auth_headers)
    assert resp.status_code == 200


def test_no_token_returns_401(client):
    resp = client.post("/api/v1/locations", json={"name": "Test"})
    assert resp.status_code == 401


def test_invalid_token_returns_401_on_protected_route(client):
    """An invalid token is rejected on purely JWT-protected routes."""
    headers = {"Authorization": "Bearer invalidtoken"}
    # POST /locations is JWT-protected; invalid token → 401
    resp = client.post("/api/v1/locations", json={"name": "Test"}, headers=headers)
    assert resp.status_code == 401


def test_invalid_token_on_dual_purpose_endpoint_returns_slim_list(client):
    """GET /locations with invalid token returns slim list (dual-purpose endpoint)."""
    headers = {"Authorization": "Bearer invalidtoken"}
    resp = client.get("/api/v1/locations", headers=headers)
    # Dual-purpose: invalid token falls back to unauthenticated → slim list, not 401
    assert resp.status_code == 200


def test_change_password(client, auth_headers):
    """FR-A05: Change password with correct current password."""
    resp = client.put(
        "/api/v1/auth/password",
        json={"current_password": "changeme123", "new_password": "newsecure456"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "Password updated"

    # Old password no longer works
    resp2 = client.post("/api/v1/auth/token", json={"username": "admin", "password": "changeme123"})
    assert resp2.status_code == 401

    # New password works
    resp3 = client.post("/api/v1/auth/token", json={"username": "admin", "password": "newsecure456"})
    assert resp3.status_code == 200
    assert resp3.json()["password_is_default"] is False


def test_change_password_wrong_current(client, auth_headers):
    """FR-A05: Reject change if current password is wrong."""
    resp = client.put(
        "/api/v1/auth/password",
        json={"current_password": "wrongpassword", "new_password": "newsecure456"},
        headers=auth_headers,
    )
    assert resp.status_code == 401


def test_change_password_requires_auth(client):
    resp = client.put(
        "/api/v1/auth/password",
        json={"current_password": "changeme123", "new_password": "new123456"},
    )
    assert resp.status_code == 401


def test_default_password_flag_clears_after_change(client, auth_headers):
    """FR-A07: password_is_default becomes False after changing password."""
    client.put(
        "/api/v1/auth/password",
        json={"current_password": "changeme123", "new_password": "newpass123"},
        headers=auth_headers,
    )
    resp = client.post("/api/v1/auth/token", json={"username": "admin", "password": "newpass123"})
    assert resp.status_code == 200
    assert resp.json()["password_is_default"] is False
