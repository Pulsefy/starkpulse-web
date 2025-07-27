from fastapi import FastAPI
from prometheus_client import make_asgi_app, Counter, Gauge, Histogram
import uvicorn
import structlog
import asyncio
import time

from config import config
from database.database import init_db, init_redis, close_redis, get_redis_client
from api.optimization_api import router as optimization_router
from services.product_service import ProductService
from core.cache_service import CacheService
from tasks.cache_warming import start_cache_warming_task

logger = structlog.get_logger(__name__)

app = FastAPI(
    title="StarkPulse Caching & Optimization System",
    description="Comprehensive system for multi-layer caching, intelligent invalidation, and performance monitoring.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Prometheus metrics setup
if config.enable_metrics:
    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)
    logger.info(f"Prometheus metrics exposed at /metrics on port {config.prometheus_port}")

    # Example custom API metrics
    API_REQUESTS_TOTAL = Counter(
        'api_requests_total', 'Total API requests', ['method', 'endpoint', 'status_code']
    )
    API_RESPONSE_TIME_SECONDS = Histogram(
        'api_response_time_seconds', 'API response time in seconds', ['method', 'endpoint']
    )

    @app.middleware("http")
    async def add_process_time_header(request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        
        API_REQUESTS_TOTAL.labels(
            method=request.method, endpoint=request.url.path, status_code=response.status_code
        ).inc()
        API_RESPONSE_TIME_SECONDS.labels(
            method=request.method, endpoint=request.url.path
        ).observe(process_time)
        
        return response

# Include API router
app.include_router(optimization_router, prefix="/api")

# Background task for cache warming
cache_warming_task: Optional[asyncio.Task] = None

@app.on_event("startup")
async def startup_event():
    """Actions to perform on application startup."""
    structlog.configure(
        processors=[
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer()
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    logger.info("Application startup initiated.")
    await init_db()
    await init_redis()

    # Initialize services for background tasks
    redis_client = await get_redis_client()
    cache_service = CacheService(redis_client)
    product_service = ProductService(cache_service)

    # Start cache warming background task
    global cache_warming_task
    cache_warming_task = asyncio.create_task(start_cache_warming_task(product_service))
    
    logger.info("Application startup complete.")

@app.on_event("shutdown")
async def shutdown_event():
    """Actions to perform on application shutdown."""
    logger.info("Application shutdown initiated.")
    if cache_warming_task:
        cache_warming_task.cancel()
        try:
            await cache_warming_task
        except asyncio.CancelledError:
            logger.info("Cache warming task cancelled.")
    await close_redis()
    logger.info("Application shutdown complete.")

@app.get("/health", summary="Health check endpoint")
async def health_check():
    """
    Provides a simple health check for the API.
    """
    return {"status": "healthy", "message": "Caching & Optimization System is running."}

if __name__ == "__main__":
    uvicorn.run(
        app, 
        host=config.api_host, 
        port=config.api_port, 
        log_level=config.log_level.lower()
    )
