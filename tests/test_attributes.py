import pytest

pytestmark = pytest.mark.asyncio


async def _create_category(client, name, parent_id=None):
    """Helper to create a category and return its id."""
    payload = {"name": name}
    if parent_id:
        payload["parent_id"] = parent_id
    resp = await client.post("/api/v1/categories", json=payload)
    assert resp.status_code == 201
    return resp.json()["id"]


class TestCreateAttribute:
    async def test_create_text_attribute(self, client):
        cat_id = await _create_category(client, "Electronics")

        resp = await client.post(f"/api/v1/categories/{cat_id}/attributes", json={
            "name": "Brand",
            "attribute_type": "text",
            "is_required": True,
            "is_filterable": True,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Brand"
        assert data["slug"] == "brand"
        assert data["attribute_type"] == "text"
        assert data["is_required"] is True
        assert data["is_filterable"] is True
        assert data["category_id"] == cat_id

    async def test_create_select_attribute_with_options(self, client):
        cat_id = await _create_category(client, "Clothing")

        resp = await client.post(f"/api/v1/categories/{cat_id}/attributes", json={
            "name": "Color",
            "attribute_type": "select",
            "options": ["Red", "Blue", "Green"],
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["attribute_type"] == "select"
        assert data["options"] == ["Red", "Blue", "Green"]

    async def test_create_select_attribute_without_options_fails(self, client):
        cat_id = await _create_category(client, "Shoes")

        resp = await client.post(f"/api/v1/categories/{cat_id}/attributes", json={
            "name": "Size",
            "attribute_type": "select",
        })
        assert resp.status_code == 400

    async def test_create_duplicate_attribute_fails(self, client):
        cat_id = await _create_category(client, "Toys")

        await client.post(f"/api/v1/categories/{cat_id}/attributes", json={
            "name": "Material",
            "attribute_type": "text",
        })
        resp = await client.post(f"/api/v1/categories/{cat_id}/attributes", json={
            "name": "Material",
            "attribute_type": "text",
        })
        assert resp.status_code == 409

    async def test_create_attribute_for_nonexistent_category(self, client):
        resp = await client.post(
            "/api/v1/categories/00000000-0000-0000-0000-000000000000/attributes",
            json={"name": "Foo", "attribute_type": "text"},
        )
        assert resp.status_code == 404


class TestUpdateAttribute:
    async def test_update_attribute_name(self, client):
        cat_id = await _create_category(client, "Furniture")
        create_resp = await client.post(f"/api/v1/categories/{cat_id}/attributes", json={
            "name": "Weight",
            "attribute_type": "number",
        })
        attr_id = create_resp.json()["id"]

        resp = await client.put(
            f"/api/v1/categories/{cat_id}/attributes/{attr_id}",
            json={"name": "Weight (kg)", "is_required": True},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Weight (kg)"
        assert resp.json()["is_required"] is True

    async def test_update_attribute_wrong_category(self, client):
        cat_a = await _create_category(client, "Cat A")
        cat_b = await _create_category(client, "Cat B")

        create_resp = await client.post(f"/api/v1/categories/{cat_a}/attributes", json={
            "name": "Foo",
            "attribute_type": "text",
        })
        attr_id = create_resp.json()["id"]

        # Try to update via different category
        resp = await client.put(
            f"/api/v1/categories/{cat_b}/attributes/{attr_id}",
            json={"name": "Bar"},
        )
        assert resp.status_code == 404


class TestDeleteAttribute:
    async def test_delete_attribute(self, client):
        cat_id = await _create_category(client, "Sports")
        create_resp = await client.post(f"/api/v1/categories/{cat_id}/attributes", json={
            "name": "League",
            "attribute_type": "text",
        })
        attr_id = create_resp.json()["id"]

        resp = await client.delete(f"/api/v1/categories/{cat_id}/attributes/{attr_id}")
        assert resp.status_code == 204

        # Verify it's gone from effective attributes
        list_resp = await client.get(f"/api/v1/categories/{cat_id}/attributes")
        slugs = [a["slug"] for a in list_resp.json()]
        assert "league" not in slugs


class TestAttributeInheritance:
    async def test_child_inherits_parent_attributes(self, client):
        # Create hierarchy: Electronics -> Phones
        elec_id = await _create_category(client, "Electronics")
        phones_id = await _create_category(client, "Phones", parent_id=elec_id)

        # Add attribute to Electronics
        await client.post(f"/api/v1/categories/{elec_id}/attributes", json={
            "name": "Brand",
            "attribute_type": "text",
            "is_required": True,
        })

        # Phones should inherit "brand"
        resp = await client.get(f"/api/v1/categories/{phones_id}/attributes")
        assert resp.status_code == 200
        attrs = resp.json()
        slugs = [a["slug"] for a in attrs]
        assert "brand" in slugs

        # The inherited attr should have inherited_from_category_id set
        brand_attr = next(a for a in attrs if a["slug"] == "brand")
        assert brand_attr["inherited_from_category_id"] == elec_id

    async def test_grandchild_inherits_through_chain(self, client):
        # Root -> Mid -> Leaf
        root_id = await _create_category(client, "Root")
        mid_id = await _create_category(client, "Mid", parent_id=root_id)
        leaf_id = await _create_category(client, "Leaf", parent_id=mid_id)

        # Root defines "brand", Mid defines "color"
        await client.post(f"/api/v1/categories/{root_id}/attributes", json={
            "name": "Brand", "attribute_type": "text",
        })
        await client.post(f"/api/v1/categories/{mid_id}/attributes", json={
            "name": "Color", "attribute_type": "text",
        })

        # Leaf should see both
        resp = await client.get(f"/api/v1/categories/{leaf_id}/attributes")
        slugs = [a["slug"] for a in resp.json()]
        assert "brand" in slugs
        assert "color" in slugs

    async def test_child_overrides_parent_attribute(self, client):
        parent_id = await _create_category(client, "Parent")
        child_id = await _create_category(client, "Child", parent_id=parent_id)

        # Parent: warranty is optional text
        await client.post(f"/api/v1/categories/{parent_id}/attributes", json={
            "name": "Warranty",
            "attribute_type": "text",
            "is_required": False,
        })

        # Child: override warranty to be required
        await client.post(f"/api/v1/categories/{child_id}/attributes", json={
            "name": "Warranty",
            "attribute_type": "text",
            "is_required": True,
        })

        # Effective attributes for child should show the overridden version
        resp = await client.get(f"/api/v1/categories/{child_id}/attributes")
        warranty = next(a for a in resp.json() if a["slug"] == "warranty")
        assert warranty["is_required"] is True
        # Own attribute has no inherited_from
        assert warranty["inherited_from_category_id"] is None

    async def test_own_attributes_have_no_inheritance_marker(self, client):
        cat_id = await _create_category(client, "Standalone")
        await client.post(f"/api/v1/categories/{cat_id}/attributes", json={
            "name": "Weight",
            "attribute_type": "number",
        })

        resp = await client.get(f"/api/v1/categories/{cat_id}/attributes")
        weight = next(a for a in resp.json() if a["slug"] == "weight")
        assert weight["inherited_from_category_id"] is None
