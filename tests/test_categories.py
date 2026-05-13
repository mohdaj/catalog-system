import pytest

pytestmark = pytest.mark.asyncio


class TestCreateCategory:
    async def test_create_root_category(self, client):
        resp = await client.post("/api/v1/categories", json={
            "name": "Electronics",
            "description": "All electronics",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Electronics"
        assert data["slug"] == "electronics"
        assert data["description"] == "All electronics"
        assert data["parent_id"] is None
        assert data["is_active"] is True
        assert "id" in data

    async def test_create_subcategory(self, client):
        # Create parent
        parent_resp = await client.post("/api/v1/categories", json={"name": "Electronics"})
        parent_id = parent_resp.json()["id"]

        # Create child
        resp = await client.post("/api/v1/categories", json={
            "name": "Phones",
            "parent_id": parent_id,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["parent_id"] == parent_id
        assert data["slug"] == "phones"

    async def test_create_category_invalid_parent(self, client):
        resp = await client.post("/api/v1/categories", json={
            "name": "Orphan",
            "parent_id": "00000000-0000-0000-0000-000000000000",
        })
        assert resp.status_code == 404

    async def test_create_category_empty_name_rejected(self, client):
        resp = await client.post("/api/v1/categories", json={"name": ""})
        assert resp.status_code == 422


class TestGetCategory:
    async def test_get_existing_category(self, client):
        create_resp = await client.post("/api/v1/categories", json={"name": "Books"})
        cat_id = create_resp.json()["id"]

        resp = await client.get(f"/api/v1/categories/{cat_id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Books"

    async def test_get_nonexistent_category(self, client):
        resp = await client.get("/api/v1/categories/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404


class TestListCategories:
    async def test_list_flat(self, client):
        await client.post("/api/v1/categories", json={"name": "Cat A"})
        await client.post("/api/v1/categories", json={"name": "Cat B"})

        resp = await client.get("/api/v1/categories")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert data["total"] >= 2

    async def test_list_tree(self, client):
        parent_resp = await client.post("/api/v1/categories", json={"name": "Root"})
        parent_id = parent_resp.json()["id"]
        await client.post("/api/v1/categories", json={"name": "Child", "parent_id": parent_id})

        resp = await client.get("/api/v1/categories?tree=true")
        assert resp.status_code == 200
        tree = resp.json()
        assert isinstance(tree, list)
        # Find the root node and check it has children
        root = next((c for c in tree if c["id"] == parent_id), None)
        assert root is not None
        assert len(root["children"]) >= 1


class TestUpdateCategory:
    async def test_update_name(self, client):
        create_resp = await client.post("/api/v1/categories", json={"name": "Old Name"})
        cat_id = create_resp.json()["id"]

        resp = await client.put(f"/api/v1/categories/{cat_id}", json={"name": "New Name"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "New Name"
        assert resp.json()["slug"] == "new-name"

    async def test_update_prevents_self_parent(self, client):
        create_resp = await client.post("/api/v1/categories", json={"name": "Self Ref"})
        cat_id = create_resp.json()["id"]

        resp = await client.put(f"/api/v1/categories/{cat_id}", json={"parent_id": cat_id})
        assert resp.status_code == 400

    async def test_update_prevents_circular_reference(self, client):
        # Create A -> B -> C
        a_resp = await client.post("/api/v1/categories", json={"name": "A"})
        a_id = a_resp.json()["id"]
        b_resp = await client.post("/api/v1/categories", json={"name": "B", "parent_id": a_id})
        b_id = b_resp.json()["id"]
        c_resp = await client.post("/api/v1/categories", json={"name": "C", "parent_id": b_id})
        c_id = c_resp.json()["id"]

        # Try to make A's parent = C (circular)
        resp = await client.put(f"/api/v1/categories/{a_id}", json={"parent_id": c_id})
        assert resp.status_code == 400


class TestDeleteCategory:
    async def test_soft_delete(self, client):
        create_resp = await client.post("/api/v1/categories", json={"name": "To Delete"})
        cat_id = create_resp.json()["id"]

        resp = await client.delete(f"/api/v1/categories/{cat_id}")
        assert resp.status_code == 204

        # Should still exist but be deactivated
        get_resp = await client.get(f"/api/v1/categories/{cat_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["is_active"] is False


class TestChildrenAndAncestors:
    async def test_get_children(self, client):
        parent_resp = await client.post("/api/v1/categories", json={"name": "Parent"})
        parent_id = parent_resp.json()["id"]
        await client.post("/api/v1/categories", json={"name": "Child 1", "parent_id": parent_id})
        await client.post("/api/v1/categories", json={"name": "Child 2", "parent_id": parent_id})

        resp = await client.get(f"/api/v1/categories/{parent_id}/children")
        assert resp.status_code == 200
        children = resp.json()
        assert len(children) == 2

    async def test_get_ancestors(self, client):
        # Create grandparent -> parent -> child
        gp_resp = await client.post("/api/v1/categories", json={"name": "Grandparent"})
        gp_id = gp_resp.json()["id"]
        p_resp = await client.post("/api/v1/categories", json={"name": "Parent", "parent_id": gp_id})
        p_id = p_resp.json()["id"]
        c_resp = await client.post("/api/v1/categories", json={"name": "Child", "parent_id": p_id})
        c_id = c_resp.json()["id"]

        resp = await client.get(f"/api/v1/categories/{c_id}/ancestors")
        assert resp.status_code == 200
        ancestors = resp.json()
        # Should return [grandparent, parent] in root-first order
        assert len(ancestors) == 2
        assert ancestors[0]["id"] == gp_id
        assert ancestors[1]["id"] == p_id

    async def test_root_category_has_no_ancestors(self, client):
        root_resp = await client.post("/api/v1/categories", json={"name": "Root"})
        root_id = root_resp.json()["id"]

        resp = await client.get(f"/api/v1/categories/{root_id}/ancestors")
        assert resp.status_code == 200
        assert resp.json() == []
