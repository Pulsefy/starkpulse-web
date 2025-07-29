from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.responses import StreamingResponse
from prometheus_client import make_asgi_app
import uvicorn
import structlog
import asyncio
import time
import uuid
import httpx

from config import config
from database.redis_client import init_redis, close_redis, get_redis_client
from core.rate_limiter import RateLimiter, RATE_LIMIT_EXCEEDED_TOTAL
from core.auth_middleware import AuthMiddleware
from core.router import APIRouter, GATEWAY_REQUESTS_TOTAL, GATEWAY_RESPONSE_TIME_SECONDS

logger = structlog.get_logger(__name__)

app = FastAPI(
    title="StarkPulse API Gateway",
    description="Institutional-grade API Gateway with rate limiting, authentication, and monitoring.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Prometheus metrics setup
if config.enable_metrics:
    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)
    logger.info(f"Prometheus metrics exposed at /metrics on port {config.prometheus_port}")

# Initialize core services
rate_limiter: RateLimiter = None
auth_middleware: AuthMiddleware = None
api_router: APIRouter = None

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
    logger.info("API Gateway startup initiated.")
    
    await init_redis()
    redis_client = await get_redis_client()
    
    global rate_limiter, auth_middleware, api_router
    rate_limiter = RateLimiter(redis_client)
    auth_middleware = AuthMiddleware(redis_client)
    api_router = APIRouter()
    
    logger.info("API Gateway startup complete.")

@app.on_event("shutdown")
async def shutdown_event():
    """Actions to perform on application shutdown."""
    logger.info("API Gateway shutdown initiated.")
    await close_redis()
    if api_router and api_router.client:
        await api_router.client.aclose()
    logger.info("API Gateway shutdown complete.")

@app.middleware("http")
async def gateway_middleware(request: Request, call_next):
    """
    Main middleware for API Key authentication, rate limiting, and routing.
    """
    request_id = str(uuid.uuid4())
    request.headers.__dict__["_list"].append(
        (b"x-request-id", request_id.encode("latin-1"))
    )
    
    start_time = time.time()
    api_key_id = "anonymous" # Default for logging if no key is found/valid

    try:
        # 1. Authenticate API Key
        api_key = await auth_middleware.authenticate_api_key(request)
        api_key_id = api_key # Use the actual API key for logging/metrics

        # 2. Rate Limiting
        if not await rate_limiter.check_rate_limit(api_key, request.url.path):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please try again later."
            )

        # 3. Route Request to Upstream
        # httpx.Request object is immutable, so we need to rebuild it for routing
        # The APIRouter expects an httpx.Request, not FastAPI's Request
        httpx_request = httpx.Request(
            method=request.method,
            url=str(request.url),
            headers=request.headers,
            content=await request.body()
        )
        
        upstream_response = await api_router.route_request(httpx_request, api_key_id)
        
        # Create FastAPI Response from httpx.Response
        response = StreamingResponse(
            content=upstream_response.aiter_bytes(),
            status_code=upstream_response.status_code,
            headers=upstream_response.headers
        )
        
        # Remove hop-by-hop headers that httpx might not remove
        # (e.g., Connection, Keep-Alive, Proxy-Authenticate, Proxy-Authorization, TE, Trailers, Transfer-Encoding, Upgrade)
        # FastAPI's StreamingResponse usually handles this, but explicit removal is safer.
        excluded_headers = ["content-encoding", "content-length", "transfer-encoding", "connection"]
        for header in excluded_headers:
            if header in response.headers:
                del response.headers[header]

    except HTTPException as e:
        response = Response(content=e.detail, status_code=e.status_code)
        logger.error(
            "Gateway request failed with HTTPException",
            method=request.method,
            path=request.url.path,
            status_code=e.status_code,
            detail=e.detail,
            api_key_id=api_key_id
        )
    except httpx.HTTPStatusError as e:
        # Catch errors from upstream services (4xx/5xx)
        response = Response(content=e.response.text, status_code=e.response.status_code)
        logger.error(
            "Upstream service returned HTTP error",
            method=request.method,
            path=request.url.path,
            status_code=e.response.status_code,
            detail=e.response.text,
            api_key_id=api_key_id
        )
    except httpx.RequestError as e:
        # Catch network/connection errors to upstream
        response = Response(content=f"Gateway Error: Could not connect to upstream service. {e}", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
        logger.error(
            "Gateway failed to connect to upstream",
            method=request.method,
            path=request.url.path,
            error=str(e),
            api_key_id=api_key_id
        )
    except Exception as e:
        response = Response(content=f"Internal Server Error: {e}", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
        logger.critical(
            "Unhandled exception in gateway middleware",
            method=request.method,
            path=request.url.path,
            error=str(e),
            api_key_id=api_key_id
        )
    
    process_time = time.time() - start_time
    
    # Record gateway metrics
    GATEWAY_REQUESTS_TOTAL.labels(
        method=request.method,
        path_prefix=request.url.path.split('/')[1] if len(request.url.path.split('/')) > 1 else 'root',
        status_code=response.status_code,
        api_key_id=api_key_id
    ).inc()
    GATEWAY_RESPONSE_TIME_SECONDS.labels(
        method=request.method,
        path_prefix=request.url.path.split('/')[1] if len(request.url.path.split('/')) > 1 else 'root',
        api_key_id=api_key_id
    ).observe(process_time)

    return response

@app.get("/health", summary="Health check endpoint")
async def health_check():
    """
    Provides a simple health check for the API Gateway.
    """
    redis_status = "unhealthy"
    try:
        redis_client = await get_redis_client()
        await redis_client.ping()
        redis_status = "healthy"
    except Exception:
        pass

    return {
        "status": "healthy",
        "message": "API Gateway is running.",
        "redis_connection": redis_status
    }

if __name__ == "__main__":
    uvicorn.run(
        app, 
        host=config.api_host, 
        port=config.api_port, 
        log_level=config.log_level.lower()
    )
