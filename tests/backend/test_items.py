"""Menu items CRUD tests for the GAC Menu Editor backend.

Tests FR-M01-M10, FR-I07, FR-I08, NFR-D02.
"""
import os


def test_create_item(client, auth_headers, test_location, sample_item):
    resp = client.post(
        f"/api/v1/locations/{test_location}/items",
        json=sample_item,
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["item"]["item_id"] == "test-dish"
    assert data["item"]["item_name"] == "Test Dish"
    assert data["item"]["price"] == 12.50
    assert data["message"] == "Item created"


def test_create_item_generates_slug(client, auth_headers, test_location):
    resp = client.post(
        f"/api/v1/locations/{test_location}/items",
        json={"item_name": "Honey Walnut Shrimps", "price": 13.0, "category": "Seafood", "description": "Delicious"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["item"]["item_id"] == "honey-walnut-shrimps"


def test_create_duplicate_item_returns_409(client, auth_headers, test_location, sample_item):
    client.post(f"/api/v1/locations/{test_location}/items", json=sample_item, headers=auth_headers)
    resp = client.post(f"/api/v1/locations/{test_location}/items", json=sample_item, headers=auth_headers)
    assert resp.status_code == 409


def test_list_items(client, auth_headers, test_location, sample_item):
    client.post(f"/api/v1/locations/{test_location}/items", json=sample_item, headers=auth_headers)
    resp = client.get(f"/api/v1/locations/{test_location}/items", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["item_id"] == "test-dish"


def test_search_items(client, auth_headers, test_location):
    client.post(
        f"/api/v1/locations/{test_location}/items",
        json={"item_name": "Honey Shrimps", "price": 13.0, "category": "Seafood", "description": "Good"},
        headers=auth_headers,
    )
    client.post(
        f"/api/v1/locations/{test_location}/items",
        json={"item_name": "Pork Chops", "price": 12.0, "category": "Meat", "description": "Good"},
        headers=auth_headers,
    )
    resp = client.get(f"/api/v1/locations/{test_location}/items?search=honey", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["item_id"] == "honey-shrimps"


def test_filter_items_by_category(client, auth_headers, test_location):
    client.post(
        f"/api/v1/locations/{test_location}/items",
        json={"item_name": "Shrimp Dish", "price": 13.0, "category": "Seafood", "description": "Test"},
        headers=auth_headers,
    )
    client.post(
        f"/api/v1/locations/{test_location}/items",
        json={"item_name": "Pork Dish", "price": 12.0, "category": "Meat", "description": "Test"},
        headers=auth_headers,
    )
    resp = client.get(f"/api/v1/locations/{test_location}/items?category=Seafood", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["category"] == "Seafood"


def test_list_categories(client, auth_headers, test_location):
    client.post(
        f"/api/v1/locations/{test_location}/items",
        json={"item_name": "Shrimp", "price": 13.0, "category": "Seafood", "description": "Test"},
        headers=auth_headers,
    )
    client.post(
        f"/api/v1/locations/{test_location}/items",
        json={"item_name": "Pork", "price": 12.0, "category": "Meat", "description": "Test"},
        headers=auth_headers,
    )
    resp = client.get(f"/api/v1/locations/{test_location}/items/categories", headers=auth_headers)
    assert resp.status_code == 200
    cats = resp.json()["categories"]
    assert "Seafood" in cats
    assert "Meat" in cats


def test_update_item(client, auth_headers, test_location, sample_item):
    client.post(f"/api/v1/locations/{test_location}/items", json=sample_item, headers=auth_headers)
    resp = client.put(
        f"/api/v1/locations/{test_location}/items/test-dish",
        json={"price": 15.00, "description": "Updated description"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["item"]["price"] == 15.00
    assert resp.json()["item"]["description"] == "Updated description"
    # item_id should remain unchanged
    assert resp.json()["item"]["item_id"] == "test-dish"


def test_update_nonexistent_item_returns_404(client, auth_headers, test_location):
    resp = client.put(
        f"/api/v1/locations/{test_location}/items/nonexistent",
        json={"price": 10.0},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_delete_item(client, auth_headers, test_location, sample_item):
    client.post(f"/api/v1/locations/{test_location}/items", json=sample_item, headers=auth_headers)
    resp = client.delete(
        f"/api/v1/locations/{test_location}/items/test-dish",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "Item deleted"

    # Item should no longer appear in list
    list_resp = client.get(f"/api/v1/locations/{test_location}/items", headers=auth_headers)
    assert list_resp.json()["total"] == 0


def test_delete_nonexistent_item_returns_404(client, auth_headers, test_location):
    resp = client.delete(
        f"/api/v1/locations/{test_location}/items/nonexistent",
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_delete_item_cleans_up_image(client, auth_headers, test_location, tmp_path):
    """FR-I08: Deleting item removes its image file."""
    import config
    loc_dir = f"{config.settings.DATA_DIR}/locations/{test_location}"
    img_dir = os.path.join(loc_dir, "uploaded_images")
    os.makedirs(img_dir, exist_ok=True)
    img_file = os.path.join(img_dir, "test_image.webp")
    with open(img_file, "wb") as f:
        f.write(b"fake image")

    client.post(
        f"/api/v1/locations/{test_location}/items",
        json={
            "item_name": "Image Item",
            "price": 10.0,
            "category": "Seafood",
            "description": "Has image",
            "image_path": "./uploaded_images/test_image.webp",
        },
        headers=auth_headers,
    )
    client.delete(f"/api/v1/locations/{test_location}/items/image-item", headers=auth_headers)
    assert not os.path.exists(img_file)


def test_update_item_cleans_old_image(client, auth_headers, test_location):
    """FR-I07: Updating item with new image_path deletes old image."""
    import config
    loc_dir = f"{config.settings.DATA_DIR}/locations/{test_location}"
    img_dir = os.path.join(loc_dir, "uploaded_images")
    os.makedirs(img_dir, exist_ok=True)
    old_img = os.path.join(img_dir, "old_image.webp")
    with open(old_img, "wb") as f:
        f.write(b"old image")

    client.post(
        f"/api/v1/locations/{test_location}/items",
        json={
            "item_name": "Update Image Item",
            "price": 10.0,
            "category": "Seafood",
            "description": "Will change image",
            "image_path": "./uploaded_images/old_image.webp",
        },
        headers=auth_headers,
    )

    new_img = os.path.join(img_dir, "new_image.webp")
    with open(new_img, "wb") as f:
        f.write(b"new image")

    client.put(
        f"/api/v1/locations/{test_location}/items/update-image-item",
        json={"image_path": "./uploaded_images/new_image.webp"},
        headers=auth_headers,
    )
    assert not os.path.exists(old_img)
    assert os.path.exists(new_img)


def test_invalid_location_returns_404(client, auth_headers):
    resp = client.get("/api/v1/locations/nonexistent/items", headers=auth_headers)
    assert resp.status_code == 404


def test_items_require_auth(client, test_location):
    resp = client.get(f"/api/v1/locations/{test_location}/items")
    assert resp.status_code == 401


def test_item_price_cannot_be_negative(client, auth_headers, test_location):
    resp = client.post(
        f"/api/v1/locations/{test_location}/items",
        json={"item_name": "Bad Item", "price": -1.0, "category": "Seafood", "description": "test"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_backup_created_on_write(client, auth_headers, test_location, sample_item):
    """NFR-R01: Backup file created before menu.json write."""
    import config
    client.post(f"/api/v1/locations/{test_location}/items", json=sample_item, headers=auth_headers)
    backup_path = f"{config.settings.DATA_DIR}/locations/{test_location}/menu.json.bak"
    assert os.path.exists(backup_path)


def test_data_isolation_between_locations(client, auth_headers):
    """C06: Items in one location don't appear in another."""
    client.post("/api/v1/locations", json={"name": "Location A"}, headers=auth_headers)
    client.post("/api/v1/locations", json={"name": "Location B"}, headers=auth_headers)

    client.post(
        "/api/v1/locations/location-a/items",
        json={"item_name": "Exclusive Dish", "price": 10.0, "category": "Seafood", "description": "Only in A"},
        headers=auth_headers,
    )

    resp = client.get("/api/v1/locations/location-b/items", headers=auth_headers)
    assert resp.json()["total"] == 0
