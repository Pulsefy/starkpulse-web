from fastapi import APIRouter, Depends, HTTPException, status, Response
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import datetime
import redis.asyncio as redis
import structlog

from database.database import get_db, get_redis_client
from sqlalchemy.ext.asyncio import AsyncSession
from core.cache_service import CacheService
from services.product_service import ProductService
from config import config

logger = structlog.get_logger(__name__)

router = APIRouter()

# Pydantic Models
class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    category: str
    stock: int = 0

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    stock: Optional[int] = None

class ProductResponse(ProductCreate):
    id: int
    created_at: datetime.datetime
    updated_at: Optional[datetime.datetime]

    class Config:
        orm_mode = True

# Dependency injection for services
async def get_cache_service(redis_client: redis.Redis = Depends(get_redis_client)):
    return CacheService(redis_client)

async def get_product_service(cache_service: CacheService = Depends(get_cache_service)):
    return ProductService(cache_service)

# --- Product Endpoints (with caching) ---
@router.post("/v1/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED, summary="Create a new product")
async def create_product(
    product_data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    product_service: ProductService = Depends(get_product_service)
):
    product = await product_service.create_product(
        db,
        name=product_data.name,
        description=product_data.description,
        price=product_data.price,
        category=product_data.category,
        stock=product_data.stock
    )
    return product

@router.get("/v1/products", response_model=List[ProductResponse], summary="Get all products (cached)")
async def get_all_products(
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    product_service: ProductService = Depends(get_product_service),
    response: Response = None # For setting Cache-Control headers
):
    products = await product_service.get_all_products(db, limit, offset)
    
    # Implement browser caching for this endpoint
    response.headers["Cache-Control"] = f"public, max-age={config.short_cache_ttl}"
    response.headers["ETag"] = f"W/{hash(str(products))}" # Simple ETag, consider more robust
    
    return products

@router.get("/v1/products/{product_id}", response_model=ProductResponse, summary="Get product by ID (cached)")
async def get_product_by_id(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    product_service: ProductService = Depends(get_product_service),
    response: Response = None # For setting Cache-Control headers
):
    product = await product_service.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Implement browser caching for this endpoint
    response.headers["Cache-Control"] = f"public, max-age={config.default_cache_ttl}"
    response.headers["ETag"] = f"W/{hash(str(product))}"
    
    return product

@router.put("/v1/products/{product_id}", response_model=ProductResponse, summary="Update a product")
async def update_product(
    product_id: int,
    updates: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    product_service: ProductService = Depends(get_product_service)
):
    product = await product_service.update_product(db, product_id, updates.dict(exclude_unset=True))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.delete("/v1/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a product")
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    product_service: ProductService = Depends(get_product_service)
):
    deleted = await product_service.delete_product(db, product_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Product not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# --- Cache Management Endpoints ---
@router.post("/v1/cache/invalidate", summary="Invalidate cache by pattern")
async def invalidate_cache(
    pattern: str,
    cache_service: CacheService = Depends(get_cache_service)
):
    await cache_service.invalidate_pattern(pattern)
    return {"message": f"Cache invalidated for pattern: {pattern}"}

@router.post("/v1/cache/warm", summary="Manually trigger cache warming")
async def trigger_cache_warming(
    db: AsyncSession = Depends(get_db),
    product_service: ProductService = Depends(get_product_service)
):
    await product_service.warm_product_cache(db)
    return {"message": "Cache warming initiated."}

@router.get("/v1/cache/stats", summary="Get cache statistics")
async def get_cache_stats(
    cache_service: CacheService = Depends(get_cache_service)
):
    stats = await cache_service.get_cache_stats()
    return stats
