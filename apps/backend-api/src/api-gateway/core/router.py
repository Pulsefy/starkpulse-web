import httpx
import asyncio
import itertools
from typing import Dict, List, Tuple, Optional
import structlog
from prometheus_client import Counter, Histogram, Gauge

from config import config

logger = structlog.get_logger(__name__)

# Prometheus Metrics for Routing
GATEWAY_REQUESTS_TOTAL = Counter(
    'gateway_requests_total',
    'Total requests processed by the gateway',
    ['method', 'path_prefix', 'status_code', 'api_key_id']
)
GATEWAY_RESPONSE_TIME_SECONDS = Histogram(
    'gateway_response_time_seconds',
    'Gateway end-to-end response time',
    ['method', 'path_prefix', 'api_key_id']
)
UPSTREAM_REQUESTS_TOTAL = Counter(
    'upstream_requests_total',
    'Total requests sent to upstream services',
    ['service_name', 'upstream_url', 'status_code']
)
UPSTREAM_RESPONSE_TIME_SECONDS = Histogram(
    'upstream_response_time_seconds',
    'Upstream service response time',
    ['service_name', 'upstream_url']
)
UPSTREAM_HEALTH_STATUS = Gauge(
    'upstream_health_status',
    'Health status of upstream services (1=healthy, 0=unhealthy)',
    ['service_name', 'upstream_url']
)

class APIRouter:
    def __init__(self):
        self.upstream_services = config.upstream_services
        self.client = httpx.AsyncClient(timeout=30.0) # Global HTTP client
        self.service_iterators: Dict[str, itertools.cycle] = {
            prefix: itertools.cycle(urls)
            for prefix, urls in self.upstream_services.items()
        }
        logger.info("APIRouter initialized with upstream services.")

    async def _get_next_upstream_url(self, path_prefix: str) -> Optional[str]:
        """
        Implements a simple round-robin load balancing strategy.
        Also includes a basic health check to avoid unhealthy instances.
        """
        urls = self.upstream_services.get(path_prefix)
        if not urls:
            return None
        
        # Try to find a healthy instance
        for _ in range(len(urls)): # Iterate through all available URLs once
            url = next(self.service_iterators[path_prefix])
            # In a real system, this health check would be more sophisticated
            # e.g., a dedicated health check endpoint, circuit breaker pattern
            if await self._is_upstream_healthy(path_prefix, url):
                return url
            logger.warning(f"Upstream service {url} for {path_prefix} is unhealthy, trying next.")
        
        logger.error(f"No healthy upstream service found for {path_prefix}")
        return None

    async def _is_upstream_healthy(self, service_name: str, url: str) -> bool:
        """Basic health check for an upstream service."""
        try:
            # For simplicity, assume a /health endpoint exists or just try to connect
            health_url = f"{url.rstrip('/')}/health" if not url.endswith('/health') else url
            response = await self.client.get(health_url, timeout=5.0)
            is_healthy = response.status_code == 200
            UPSTREAM_HEALTH_STATUS.labels(service_name=service_name, upstream_url=url).set(1 if is_healthy else 0)
            if not is_healthy:
                logger.warning(f"Upstream {url} health check failed with status {response.status_code}")
            return is_healthy
        except httpx.RequestError as e:
            logger.error(f"Upstream {url} health check failed: {e}")
            UPSTREAM_HEALTH_STATUS.labels(service_name=service_name, upstream_url=url).set(0)
            return False

    async def route_request(self, request: httpx.Request, api_key: str) -> httpx.Response:
        """
        Routes the incoming request to the appropriate upstream service.
        Performs request/response transformation and metrics collection.
        """
        path = request.url.path
        method = request.method
        
        # Determine the path prefix for routing
        path_prefix = None
        for prefix in self.upstream_services.keys():
            if path.startswith(prefix):
                path_prefix = prefix
                break
        
        if not path_prefix:
            logger.warning(f"No upstream service configured for path: {path}")
            raise httpx.HTTPStatusError(
                "No upstream service configured for this path",
                request=request,
                response=httpx.Response(status_code=404, request=request)
            )

        upstream_url_base = await self._get_next_upstream_url(path_prefix)
        if not upstream_url_base:
            raise httpx.HTTPStatusError(
                "No healthy upstream service available",
                request=request,
                response=httpx.Response(status_code=503, request=request)
            )

        # Construct the new URL for the upstream service
        # Remove the gateway's API prefix if it exists (e.g., /api)
        # For this example, assuming gateway path is directly mapped to upstream path
        relative_path = path
        if relative_path.startswith('/api'):
            relative_path = relative_path[4:] # Remove /api prefix if present

        # Ensure the upstream_url_base ends without a slash and relative_path starts with one
        full_upstream_url = f"{upstream_url_base.rstrip('/')}{relative_path}"
        
        # Create a new httpx.Request object for the upstream service
        # Copy headers, method, content, etc.
        # Remove gateway-specific headers like X-API-Key before forwarding
        headers = dict(request.headers)
        if "X-API-Key" in headers:
            del headers["X-API-Key"]
        
        # Example: Add a gateway-specific header for upstream tracing
        headers["X-Gateway-Request-ID"] = request.headers.get("X-Request-ID", "N/A")
        
        upstream_request = self.client.build_request(
            method,
            full_upstream_url,
            headers=headers,
            content=request.content,
            params=request.url.params,
            timeout=request.timeout
        )

        start_time_upstream = asyncio.get_event_loop().time()
        try:
            upstream_response = await self.client.send(upstream_request, stream=True)
            upstream_response.raise_for_status() # Raise for 4xx/5xx responses
            
            UPSTREAM_REQUESTS_TOTAL.labels(
                service_name=path_prefix,
                upstream_url=upstream_url_base,
                status_code=upstream_response.status_code
            ).inc()
            UPSTREAM_RESPONSE_TIME_SECONDS.labels(
                service_name=path_prefix,
                upstream_url=upstream_url_base
            ).observe(asyncio.get_event_loop().time() - start_time_upstream)
            
            logger.info(
                "Request routed successfully",
                method=method,
                path=path,
                upstream_url=full_upstream_url,
                status_code=upstream_response.status_code,
                api_key_id=api_key
            )
            return upstream_response
            
        except httpx.HTTPStatusError as e:
            logger.error(
                "Upstream service returned error",
                method=method,
                path=path,
                upstream_url=full_upstream_url,
                status_code=e.response.status_code,
                detail=e.response.text,
                api_key_id=api_key
            )
            UPSTREAM_REQUESTS_TOTAL.labels(
                service_name=path_prefix,
                upstream_url=upstream_url_base,
                status_code=e.response.status_code
            ).inc()
            UPSTREAM_RESPONSE_TIME_SECONDS.labels(
                service_name=path_prefix,
                upstream_url=upstream_url_base
            ).observe(asyncio.get_event_loop().time() - start_time_upstream)
            raise # Re-raise to be caught by FastAPI's exception handler
        except httpx.RequestError as e:
            logger.error(
                "Failed to connect to upstream service",
                method=method,
                path=path,
                upstream_url=full_upstream_url,
                error=str(e),
                api_key_id=api_key
            )
            UPSTREAM_REQUESTS_TOTAL.labels(
                service_name=path_prefix,
                upstream_url=upstream_url_base,
                status_code=500 # Indicate internal error for upstream connection failure
            ).inc()
            UPSTREAM_RESPONSE_TIME_SECONDS.labels(
                service_name=path_prefix,
                upstream_url=upstream_url_base
            ).observe(asyncio.get_event_loop().time() - start_time_upstream)
            raise httpx.HTTPStatusError(
                f"Failed to connect to upstream service: {e}",
                request=request,
                response=httpx.Response(status_code=500, request=request)
            )
