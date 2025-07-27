from fastapi import FastAPI
from prometheus_client import make_asgi_app, Counter, Gauge, Histogram
import uvicorn
import structlog
import asyncio
import time

from config import config
from database.database import init_db, init_redis, close_redis
from api.validation_api import router as validation_router
from core.validator_node import ValidatorNode

logger = structlog.get_logger(__name__)

app = FastAPI(
    title="StarkPulse Distributed Content Validation Network",
    description="A distributed network for content validation using consensus and reputation scoring.",
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
app.include_router(validation_router, prefix="/api")

# Validator Node instance (running within this same process for demonstration)
validator_node: Optional[ValidatorNode] = None
validator_node_task: Optional[asyncio.Task] = None

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

    # Initialize and start the validator node
    global validator_node, validator_node_task
    validator_node = ValidatorNode(
        validator_id=config.validator_node_id,
        api_url=config.validator_node_api_url
    )
    await validator_node.initialize_services()
    await validator_node.register_self() # Register this node
    validator_node_task = asyncio.create_task(validator_node.start_monitoring_loop())
    
    logger.info("Application startup complete.")

@app.on_event("shutdown")
async def shutdown_event():
    """Actions to perform on application shutdown."""
    logger.info("Application shutdown initiated.")
    if validator_node_task:
        validator_node_task.cancel()
        try:
            await validator_node_task
        except asyncio.CancelledError:
            logger.info("Validator node task cancelled.")
    if validator_node:
        await validator_node.stop()
    await close_redis()
    logger.info("Application shutdown complete.")

@app.get("/health", summary="Health check endpoint")
async def health_check():
    """
    Provides a simple health check for the API.
    """
    return {"status": "healthy", "message": "Content Validation System is running."}

if __name__ == "__main__":
    uvicorn.run(
        app, 
        host=config.api_host, 
        port=config.api_port, 
        log_level=config.log_level.lower()
    )
