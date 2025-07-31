import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database.models import Product
from services.product_service import ProductService
from core.cache_service import CacheService
from config import config

# Fixture for mock CacheService
@pytest.fixture
def mock_cache_service():
    mock = AsyncMock(spec=CacheService)
    mock.get.return_value = None # Default to cache miss
    mock.set.return_value = None
    mock.delete.return_value = None
    mock.invalidate_pattern.return_value = None
    
    # Mock the cached decorator to just call the original function
    def mock_cached_decorator(key_prefix, ttl=None, cache_name="default"):
        def decorator(func):
            async def wrapper(*args, **kwargs):
                # Simulate cache check
                cache_key_suffix = hashlib.sha256(json.dumps(args, default=str).encode() + json.dumps(kwargs, default=str).encode()).hexdigest()
                cache_key = f"{key_prefix}:{func.__name__}:{cache_key_suffix}"
                
                cached_result = await mock.get(cache_key, cache_name=cache_name)
                if cached_result is not None:
                    return cached_result
                
                result = await func(*args, **kwargs)
                await mock.set(cache_key, result, ttl=ttl, cache_name=cache_name)
                return result
            return wrapper
        return decorator
    
    mock.cached = MagicMock(side_effect=mock_cached_decorator)
    return mock

# Fixture for ProductService
@pytest.fixture
def product_service(mock_cache_service):
    return ProductService(mock_cache_service)

@pytest.mark.asyncio
async def test_create_product(db_session: AsyncSession, product_service: ProductService, mock_cache_service):
    product_data = {
        "name": "Test Product",
        "description": "A description",
        "price": 99.99,
        "category": "Electronics",
        "stock": 10
    }
    
    product = await product_service.create_product(db_session, **product_data)
    
    assert product["name"] == product_data["name"]
    assert product["id"] is not None
    
    # Verify cache invalidation calls
    mock_cache_service.invalidate_pattern.assert_called_with(f"{product_service.product_list_cache_key}*", cache_name=product_service.cache_name)
    mock_cache_service.invalidate_pattern.assert_called_with(f"{product_service.product_detail_prefix}:get_product_by_id:*", cache_name=product_service.cache_name)

    # Verify product is in DB
    stmt = select(Product).where(Product.id == product["id"])
    result = await db_session.execute(stmt)
    retrieved_product = result.scalar_one()
    assert retrieved_product.name == product_data["name"]

@pytest.mark.asyncio
async def test_get_all_products(db_session: AsyncSession, product_service: ProductService, mock_cache_service):
    # Add a product to ensure there's data
    await product_service.create_product(db_session, "Product A", "Desc A", 10.0, "Cat1", 5)
    await db_session.commit() # Commit to make it visible

    products = await product_service.get_all_products(db_session)
    assert len(products) >= 1
    assert "Product A" in [p["name"] for p in products]
    
    # Verify cache calls (get and set from decorator)
    mock_cache_service.get.assert_called_once()
    mock_cache_service.set.assert_called_once()

@pytest.mark.asyncio
async def test_get_product_by_id(db_session: AsyncSession, product_service: ProductService, mock_cache_service):
    created_product = await product_service.create_product(db_session, "Product B", "Desc B", 20.0, "Cat2", 15)
    await db_session.commit()

    product = await product_service.get_product_by_id(db_session, created_product["id"])
    assert product["name"] == "Product B"
    
    # Verify cache calls (get and set from decorator)
    mock_cache_service.get.assert_called_once()
    mock_cache_service.set.assert_called_once()

@pytest.mark.asyncio
async def test_update_product(db_session: AsyncSession, product_service: ProductService, mock_cache_service):
    created_product = await product_service.create_product(db_session, "Product C", "Desc C", 30.0, "Cat3", 20)
    await db_session.commit()

    updated_product = await product_service.update_product(db_session, created_product["id"], {"price": 35.0, "stock": 25})
    assert updated_product["price"] == 35.0
    assert updated_product["stock"] == 25
    
    # Verify cache invalidation calls
    mock_cache_service.invalidate_pattern.assert_called_with(f"{product_service.product_list_cache_key}*", cache_name=product_service.cache_name)
    mock_cache_service.delete.assert_called_with(f"{product_service.product_detail_prefix}:{created_product['id']}", cache_name=product_service.cache_name)
    mock_cache_service.invalidate_pattern.assert_called_with(f"{product_service.product_detail_prefix}:get_product_by_id:*", cache_name=product_service.cache_name)


@pytest.mark.asyncio
async def test_delete_product(db_session: AsyncSession, product_service: ProductService, mock_cache_service):
    created_product = await product_service.create_product(db_session, "Product D", "Desc D", 40.0, "Cat4", 30)
    await db_session.commit()

    deleted = await product_service.delete_product(db_session, created_product["id"])
    assert deleted is True
    
    # Verify cache invalidation calls
    mock_cache_service.invalidate_pattern.assert_called_with(f"{product_service.product_list_cache_key}*", cache_name=product_service.cache_name)
    mock_cache_service.delete.assert_called_with(f"{product_service.product_detail_prefix}:{created_product['id']}", cache_name=product_service.cache_name)
    mock_cache_service.invalidate_pattern.assert_called_with(f"{product_service.product_detail_prefix}:get_product_by_id:*", cache_name=product_service.cache_name)

    # Verify product is deleted from DB
    stmt = select(Product).where(Product.id == created_product["id"])
    result = await db_session.execute(stmt)
    assert result.scalar_one_or_none() is None

@pytest.mark.asyncio
async def test_warm_product_cache(db_session: AsyncSession, product_service: ProductService, mock_cache_service):
    # Add some products
    for i in range(5):
        await product_service.create_product(db_session, f"Warm Product {i}", "Desc", 10.0 + i, "WarmCat", 10)
    await db_session.commit()

    await product_service.warm_product_cache(db_session)
    
    # Verify that get_all_products was called (which uses the cached decorator)
    # and that individual products were set in cache
    assert mock_cache_service.cached.called # The decorator itself was used
    assert mock_cache_service.set.call_count >= 5 # At least 5 individual products + 1 for the list
    
    # Check if specific product detail keys were set
    for i in range(5):
        # The exact key for the decorator is complex, but direct set should be there
        assert any(f"product:detail:{p.id}" in call.args[0] for call in mock_cache_service.set.call_args_list for p in (await db_session.execute(select(Product))).scalars().all())
