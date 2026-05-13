import pytest

pytestmark = pytest.mark.asyncio


async def _setup_category_with_attrs(client):
    """
    Helper: creates Electronics -> Phones with attributes.
    Electronics: brand (text, required)
    Phones: storage (select, required, options=["64GB", "128GB", "256GB"])
    Returns (electronics_id, phones_id).
    """
    elec_resp = await client.post("/api/v1/categories", json={"name": "Electronics"})
    elec_id = elec_resp.json()["id"]

    phones_resp = await client.post("/api/v1/categories", json={
        "name": "Phones", "parent_id": elec_id,
    })
    phones_id = phones_resp.json()["id"]

    await client.post(f"/api/v1/categories/{elec_id}/attributes", json={
        "name": "Brand", "attribute_type": "text", "is_required": True,
    })
    await client.post(f"/api/v1/categories/{phones_id}/attributes", json={
        "name": "Storage",
        "attribute_type": "select",
        "is_required": True,
        "options": ["64GB", "128GB", "256GB"],
    })

    return elec_id, phones_id


class TestCreateProduct:
    async def test_create_product_with_valid_attributes(self, client):
        _, phones_id = await _setup_category_with_attrs(client)

        resp = await client.post("/api/v1/products", json={
            "name": "iPhone 15",
            "category_id": phones_id,
            "base_price": 999.99,
            "status": "active",
            "attributes": {"brand": "Apple", "storage": "128GB"},
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "iPhone 15"
        assert data["slug"] == "iphone-15"
        assert data["base_price"] == 999.99
        assert data["status"] == "active"
        assert data["attributes"]["brand"] == "Apple"
        assert data["attributes"]["storage"] == "128GB"

    async def test_create_product_missing_required_attribute(self, client):
        _, phones_id = await _setup_category_with_attrs(client)

        # Missing "brand" (required, inherited from Electronics)
        resp = await client.post("/api/v1/products", json={
            "name": "Galaxy S24",
            "category_id": phones_id,
            "base_price": 799.99,
            "attributes": {"storage": "256GB"},
        })
        assert resp.status_code == 400
        detail = resp.json()["detail"]
        assert "attribute_errors" in detail
        assert any("brand" in e for e in detail["attribute_errors"])

    async def test_create_product_invalid_select_value(self, client):
        _, phones_id = await _setup_category_with_attrs(client)

        resp = await client.post("/api/v1/products", json={
            "name": "Pixel 9",
            "category_id": phones_id,
            "base_price": 699.99,
            "attributes": {"brand": "Google", "storage": "1TB"},  # Invalid storage option
        })
        assert resp.status_code == 400
        detail = resp.json()["detail"]
        assert any("storage" in e for e in detail["attribute_errors"])

    async def test_create_product_unknown_attribute(self, client):
        _, phones_id = await _setup_category_with_attrs(client)

        resp = await client.post("/api/v1/products", json={
            "name": "Test Phone",
            "category_id": phones_id,
            "base_price": 100,
            "attributes": {"brand": "Test", "storage": "64GB", "nonexistent": "value"},
        })
        assert resp.status_code == 400
        detail = resp.json()["detail"]
        assert any("nonexistent" in e for e in detail["attribute_errors"])

    async def test_create_product_wrong_attribute_type(self, client):
        _, phones_id = await _setup_category_with_attrs(client)

        resp = await client.post("/api/v1/products", json={
            "name": "Type Error Phone",
            "category_id": phones_id,
            "base_price": 100,
            "attributes": {"brand": 123, "storage": "64GB"},  # brand should be text
        })
        assert resp.status_code == 400

    async def test_create_product_nonexistent_category(self, client):
        resp = await client.post("/api/v1/products", json={
            "name": "Orphan Product",
            "category_id": "00000000-0000-0000-0000-000000000000",
            "base_price": 10,
        })
        assert resp.status_code == 404

    async def test_create_product_no_attributes_when_none_required(self, client):
        # Category with no required attributes
        cat_resp = await client.post("/api/v1/categories", json={"name": "Generic"})
        cat_id = cat_resp.json()["id"]

        resp = await client.post("/api/v1/products", json={
            "name": "Simple Product",
            "category_id": cat_id,
            "base_price": 5.00,
        })
        assert resp.status_code == 201


class TestGetProduct:
    async def test_get_existing_product(self, client):
        cat_resp = await client.post("/api/v1/categories", json={"name": "Books"})
        cat_id = cat_resp.json()["id"]

        create_resp = await client.post("/api/v1/products", json={
            "name": "Clean Code",
            "category_id": cat_id,
            "base_price": 39.99,
        })
        product_id = create_resp.json()["id"]

        resp = await client.get(f"/api/v1/products/{product_id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Clean Code"

    async def test_get_nonexistent_product(self, client):
        resp = await client.get("/api/v1/products/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404


class TestListProducts:
    async def test_list_with_pagination(self, client):
        cat_resp = await client.post("/api/v1/categories", json={"name": "Widgets"})
        cat_id = cat_resp.json()["id"]

        # Create 3 products
        for i in range(3):
            await client.post("/api/v1/products", json={
                "name": f"Widget {i}",
                "category_id": cat_id,
                "base_price": 10.00 + i,
            })

        resp = await client.get(f"/api/v1/products?category_id={cat_id}&limit=2&offset=0")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 2
        assert data["total"] == 3
        assert data["limit"] == 2
        assert data["offset"] == 0

    async def test_list_filter_by_status(self, client):
        cat_resp = await client.post("/api/v1/categories", json={"name": "Gadgets"})
        cat_id = cat_resp.json()["id"]

        await client.post("/api/v1/products", json={
            "name": "Active Gadget", "category_id": cat_id, "base_price": 50, "status": "active",
        })
        await client.post("/api/v1/products", json={
            "name": "Draft Gadget", "category_id": cat_id, "base_price": 30, "status": "draft",
        })

        resp = await client.get(f"/api/v1/products?category_id={cat_id}&status=active")
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert all(p["status"] == "active" for p in items)

    async def test_list_filter_by_price_range(self, client):
        cat_resp = await client.post("/api/v1/categories", json={"name": "Priced Items"})
        cat_id = cat_resp.json()["id"]

        await client.post("/api/v1/products", json={
            "name": "Cheap", "category_id": cat_id, "base_price": 10,
        })
        await client.post("/api/v1/products", json={
            "name": "Mid", "category_id": cat_id, "base_price": 50,
        })
        await client.post("/api/v1/products", json={
            "name": "Expensive", "category_id": cat_id, "base_price": 200,
        })

        resp = await client.get(f"/api/v1/products?category_id={cat_id}&min_price=20&max_price=100")
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) == 1
        assert items[0]["name"] == "Mid"


class TestUpdateProduct:
    async def test_update_product_fields(self, client):
        cat_resp = await client.post("/api/v1/categories", json={"name": "Gear"})
        cat_id = cat_resp.json()["id"]

        create_resp = await client.post("/api/v1/products", json={
            "name": "Headphones",
            "category_id": cat_id,
            "base_price": 50,
        })
        product_id = create_resp.json()["id"]

        resp = await client.put(f"/api/v1/products/{product_id}", json={
            "name": "Premium Headphones",
            "base_price": 99.99,
            "status": "active",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Premium Headphones"
        assert data["base_price"] == 99.99
        assert data["status"] == "active"

    async def test_update_product_revalidates_attributes(self, client):
        _, phones_id = await _setup_category_with_attrs(client)

        create_resp = await client.post("/api/v1/products", json={
            "name": "Valid Phone",
            "category_id": phones_id,
            "base_price": 500,
            "attributes": {"brand": "Samsung", "storage": "128GB"},
        })
        product_id = create_resp.json()["id"]

        # Update with invalid attribute value
        resp = await client.put(f"/api/v1/products/{product_id}", json={
            "attributes": {"brand": "Samsung", "storage": "2TB"},  # Invalid
        })
        assert resp.status_code == 400


class TestDeleteProduct:
    async def test_delete_product(self, client):
        cat_resp = await client.post("/api/v1/categories", json={"name": "Disposable"})
        cat_id = cat_resp.json()["id"]

        create_resp = await client.post("/api/v1/products", json={
            "name": "Temp Product",
            "category_id": cat_id,
            "base_price": 1,
        })
        product_id = create_resp.json()["id"]

        resp = await client.delete(f"/api/v1/products/{product_id}")
        assert resp.status_code == 204

        # Confirm it's gone
        get_resp = await client.get(f"/api/v1/products/{product_id}")
        assert get_resp.status_code == 404


class TestSearchProducts:
    async def test_search_by_name(self, client):
        cat_resp = await client.post("/api/v1/categories", json={"name": "SearchCat"})
        cat_id = cat_resp.json()["id"]

        await client.post("/api/v1/products", json={
            "name": "Bluetooth Speaker", "category_id": cat_id, "base_price": 30,
        })
        await client.post("/api/v1/products", json={
            "name": "Wired Earbuds", "category_id": cat_id, "base_price": 15,
        })

        resp = await client.get("/api/v1/products/search?q=bluetooth")
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert any("Bluetooth" in p["name"] for p in items)

    async def test_search_empty_query_rejected(self, client):
        resp = await client.get("/api/v1/products/search?q=")
        assert resp.status_code == 422


class TestTags:
    async def test_create_and_list_tags(self, client):
        resp = await client.post("/api/v1/tags", json={"name": "Sale"})
        assert resp.status_code == 201
        assert resp.json()["slug"] == "sale"

        list_resp = await client.get("/api/v1/tags")
        assert list_resp.status_code == 200
        assert any(t["slug"] == "sale" for t in list_resp.json())

    async def test_create_duplicate_tag_fails(self, client):
        await client.post("/api/v1/tags", json={"name": "New"})
        resp = await client.post("/api/v1/tags", json={"name": "New"})
        assert resp.status_code == 409

    async def test_attach_and_detach_tag(self, client):
        cat_resp = await client.post("/api/v1/categories", json={"name": "Tagged"})
        cat_id = cat_resp.json()["id"]
        prod_resp = await client.post("/api/v1/products", json={
            "name": "Tagged Product", "category_id": cat_id, "base_price": 20,
        })
        product_id = prod_resp.json()["id"]

        tag_resp = await client.post("/api/v1/tags", json={"name": "Featured"})
        tag_id = tag_resp.json()["id"]

        # Attach
        attach_resp = await client.post(
            f"/api/v1/products/{product_id}/tags",
            json={"tag_id": tag_id},
        )
        assert attach_resp.status_code == 201

        # Verify on product
        get_resp = await client.get(f"/api/v1/products/{product_id}")
        tags = get_resp.json()["tags"]
        assert any(t["id"] == tag_id for t in tags)

        # Detach
        detach_resp = await client.delete(f"/api/v1/products/{product_id}/tags/{tag_id}")
        assert detach_resp.status_code == 204

    async def test_attach_same_tag_twice_fails(self, client):
        cat_resp = await client.post("/api/v1/categories", json={"name": "DupTag"})
        cat_id = cat_resp.json()["id"]
        prod_resp = await client.post("/api/v1/products", json={
            "name": "DupTag Product", "category_id": cat_id, "base_price": 10,
        })
        product_id = prod_resp.json()["id"]

        tag_resp = await client.post("/api/v1/tags", json={"name": "Promo"})
        tag_id = tag_resp.json()["id"]

        await client.post(f"/api/v1/products/{product_id}/tags", json={"tag_id": tag_id})
        resp = await client.post(f"/api/v1/products/{product_id}/tags", json={"tag_id": tag_id})
        assert resp.status_code == 409
