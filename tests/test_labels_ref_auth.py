import pytest

pytestmark = pytest.mark.asyncio


# =========================================================================
# Labels
# =========================================================================

class TestCategoryLabels:
    async def test_create_category_with_labels(self, client):
        resp = await client.post("/api/v1/categories", json={
            "name": "Electronics",
            "labels": {"en": "Electronics", "ar": "\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a\u0627\u062a"},
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["labels"]["en"] == "Electronics"
        assert data["labels"]["ar"] == "\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a\u0627\u062a"

    async def test_create_category_without_labels(self, client):
        resp = await client.post("/api/v1/categories", json={"name": "Books"})
        assert resp.status_code == 201
        assert resp.json()["labels"] is None

    async def test_update_category_labels(self, client):
        create_resp = await client.post("/api/v1/categories", json={"name": "Food"})
        cat_id = create_resp.json()["id"]

        resp = await client.put(f"/api/v1/categories/{cat_id}", json={
            "labels": {"en": "Food", "fr": "Nourriture"},
        })
        assert resp.status_code == 200
        assert resp.json()["labels"]["fr"] == "Nourriture"


class TestProductLabels:
    async def test_create_product_with_labels(self, client):
        cat_resp = await client.post("/api/v1/categories", json={"name": "Gadgets"})
        cat_id = cat_resp.json()["id"]

        resp = await client.post("/api/v1/products", json={
            "name": "Widget X",
            "category_id": cat_id,
            "base_price": 29.99,
            "labels": {"en": "Widget X", "ar": "\u0648\u064a\u062c\u062a \u0625\u0643\u0633"},
        })
        assert resp.status_code == 201
        assert resp.json()["labels"]["ar"] == "\u0648\u064a\u062c\u062a \u0625\u0643\u0633"


class TestAttributeLabels:
    async def test_create_attribute_with_labels(self, client):
        cat_resp = await client.post("/api/v1/categories", json={"name": "Vehicles"})
        cat_id = cat_resp.json()["id"]

        resp = await client.post(f"/api/v1/categories/{cat_id}/attributes", json={
            "name": "Color",
            "attribute_type": "text",
            "labels": {"en": "Color", "ar": "\u0627\u0644\u0644\u0648\u0646"},
        })
        assert resp.status_code == 201
        assert resp.json()["labels"]["ar"] == "\u0627\u0644\u0644\u0648\u0646"


# =========================================================================
# Reference Paths
# =========================================================================

class TestRefPath:
    async def test_lookup_category_by_ref(self, client):
        # Create Electronics -> Phones
        elec_resp = await client.post("/api/v1/categories", json={"name": "Electronics"})
        elec_id = elec_resp.json()["id"]
        phones_resp = await client.post("/api/v1/categories", json={
            "name": "Phones", "parent_id": elec_id,
        })
        phones_id = phones_resp.json()["id"]

        resp = await client.get("/api/v1/lookup?ref=electronics.phones")
        assert resp.status_code == 200
        data = resp.json()
        assert data["type"] == "category"
        assert data["data"]["id"] == phones_id
        assert data["data"]["ref_path"] == "electronics.phones"

    async def test_lookup_product_by_ref(self, client):
        cat_resp = await client.post("/api/v1/categories", json={"name": "Music"})
        cat_id = cat_resp.json()["id"]

        prod_resp = await client.post("/api/v1/products", json={
            "name": "Guitar Pro",
            "category_id": cat_id,
            "base_price": 299.99,
        })
        product_id = prod_resp.json()["id"]

        resp = await client.get("/api/v1/lookup?ref=music.guitar-pro")
        assert resp.status_code == 200
        data = resp.json()
        assert data["type"] == "product"
        assert data["data"]["id"] == product_id
        assert data["data"]["ref_path"] == "music.guitar-pro"

    async def test_lookup_not_found(self, client):
        resp = await client.get("/api/v1/lookup?ref=nonexistent.path")
        assert resp.status_code == 404

    async def test_lookup_deep_path(self, client):
        # Create A -> B -> C
        a = await client.post("/api/v1/categories", json={"name": "LevelA"})
        a_id = a.json()["id"]
        b = await client.post("/api/v1/categories", json={"name": "LevelB", "parent_id": a_id})
        b_id = b.json()["id"]
        c = await client.post("/api/v1/categories", json={"name": "LevelC", "parent_id": b_id})
        c_id = c.json()["id"]

        resp = await client.get("/api/v1/lookup?ref=levela.levelb.levelc")
        assert resp.status_code == 200
        assert resp.json()["data"]["id"] == c_id
        assert resp.json()["data"]["ref_path"] == "levela.levelb.levelc"


# =========================================================================
# Auth
# =========================================================================

async def _login_as_superadmin(client):
    """Helper: log in with the seeded superadmin and return the token."""
    resp = await client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "admin123",
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]


class TestAuth:
    async def test_login_success(self, client):
        resp = await client.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "admin123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_invalid_password(self, client):
        resp = await client.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401

    async def test_get_me(self, client):
        token = await _login_as_superadmin(client)
        resp = await client.get("/api/v1/auth/me", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "admin"
        assert data["role"] == "superadmin"

    async def test_register_by_superadmin(self, client):
        token = await _login_as_superadmin(client)
        resp = await client.post("/api/v1/auth/register", json={
            "username": "newadmin",
            "email": "newadmin@test.com",
            "password": "secret123",
            "role": "admin",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 201
        assert resp.json()["role"] == "admin"

    async def test_register_without_auth_fails(self, client):
        resp = await client.post("/api/v1/auth/register", json={
            "username": "hacker",
            "email": "hacker@test.com",
            "password": "secret123",
        })
        assert resp.status_code == 403 or resp.status_code == 401

    async def test_list_users_superadmin_only(self, client):
        token = await _login_as_superadmin(client)
        resp = await client.get("/api/v1/auth/users", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_invalid_token_rejected(self, client):
        resp = await client.get("/api/v1/auth/me", headers={
            "Authorization": "Bearer invalid.token.here",
        })
        assert resp.status_code == 401
