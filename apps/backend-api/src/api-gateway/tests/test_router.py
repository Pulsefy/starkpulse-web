import pytest
import asyncio
import httpx
from unittest.mock import AsyncMock, MagicMock

from core.router import APIRouter, UPSTREAM_HEALTH_STATUS, UPSTREAM_REQUESTS_TOTAL, UPSTREAM_RESPONSE_TIME_SECONDS
from config import config

@pytest.fixture
def mock_httpx_client():
    mock = AsyncMock(spec=httpx.AsyncClient)
    mock.build_request.return_value = MagicMock(spec=httpx.Request)
    mock.send.return_value = AsyncMock(spec=httpx.Response)
    mock.send.return_value.status_code = 200
    mock.send.return_value.aiter_bytes.return_value = AsyncMock()
    mock.send.return_value.headers = httpx.Headers()
    mock.send.return_value.raise_for_status.return_value = None
    mock.get.return_value = AsyncMock(spec=httpx.Response)
    mock.get.return_value.status_code = 200
    return mock

@pytest.fixture
def api_router(mock_httpx_client):
    # Reset Prometheus counters before each test
    UPSTREAM_HEALTH_STATUS._metrics.clear()
    UPSTREAM_REQUESTS_TOTAL._value = 0
    UPSTREAM_RESPONSE_TIME_SECONDS._metrics.clear()
    
    router = APIRouter()
    router.client = mock_httpx_client # Inject mock client
    return router

@pytest.mark.asyncio
async def test_route_request_success(api_router: APIRouter, mock_httpx_client):
    # Temporarily modify config for predictable upstream
    original_upstream = config.upstream_services.copy()
    config.upstream_services = {"/test": ["http://test-upstream.com/test"]}
    api_router.upstream_services = config.upstream_services
    api_router.service_iterators = {"/test": itertools.cycle(config.upstream_services["/test"])}

    mock_httpx_client.get.return_value.status_code = 200 # Ensure health check passes

    request = httpx.Request("GET", "http://gateway.com/api/test/path", headers={"X-API-Key": "test_key"})
    api_key = "test_key"

    response = await api_router.route_request(request, api_key)

    assert response.status_code == 200
    mock_httpx_client.build_request.assert_called_once()
    mock_httpx_client.send.assert_called_once()
    
    # Verify metrics
    assert UPSTREAM_REQUESTS_TOTAL._value == 1
    assert UPSTREAM_REQUESTS_TOTAL._metrics[('test', 'http://test-upstream.com/test', 200)]._value == 1
    assert UPSTREAM_RESPONSE_TIME_SECONDS._metrics[('test', 'http://test-upstream.com/test')].count == 1

    config.upstream_services = original_upstream # Restore original config

@pytest.mark.asyncio
async def test_route_request_no_upstream_configured(api_router: APIRouter):
    request = httpx.Request("GET", "http://gateway.com/api/nonexistent/path")
    api_key = "test_key"

    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await api_router.route_request(request, api_key)
    
    assert exc_info.value.response.status_code == 404
    assert "No upstream service configured" in exc_info.value.message

@pytest.mark.asyncio
async def test_route_request_unhealthy_upstream(api_router: APIRouter, mock_httpx_client):
    # Temporarily modify config for predictable upstream
    original_upstream = config.upstream_services.copy()
    config.upstream_services = {"/test": ["http://unhealthy-upstream.com/test"]}
    api_router.upstream_services = config.upstream_services
    api_router.service_iterators = {"/test": itertools.cycle(config.upstream_services["/test"])}

    mock_httpx_client.get.return_value.status_code = 500 # Simulate unhealthy upstream
    mock_httpx_client.send.side_effect = httpx.RequestError("Connection refused", request=httpx.Request("GET", "http://unhealthy-upstream.com/test"))

    request = httpx.Request("GET", "http://gateway.com/api/test/path")
    api_key = "test_key"

    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await api_router.route_request(request, api_key)
    
    assert exc_info.value.response.status_code == 503
    assert "No healthy upstream service available" in exc_info.value.message
    assert UPSTREAM_HEALTH_STATUS._metrics[('test', 'http://unhealthy-upstream.com/test')]._value == 0

    config.upstream_services = original_upstream # Restore original config

@pytest.mark.asyncio
async def test_route_request_upstream_http_error(api_router: APIRouter, mock_httpx_client):
    # Temporarily modify config for predictable upstream
    original_upstream = config.upstream_services.copy()
    config.upstream_services = {"/test": ["http://error-upstream.com/test"]}
    api_router.upstream_services = config.upstream_services
    api_router.service_iterators = {"/test": itertools.cycle(config.upstream_services["/test"])}

    mock_httpx_client.get.return_value.status_code = 200 # Health check passes
    mock_httpx_client.send.return_value.status_code = 400
    mock_httpx_client.send.return_value.raise_for_status.side_effect = httpx.HTTPStatusError(
        "Bad Request", request=httpx.Request("GET", "http://error-upstream.com/test"), response=httpx.Response(400, request=httpx.Request("GET", "http://error-upstream.com/test"))
    )

    request = httpx.Request("GET", "http://gateway.com/api/test/path")
    api_key = "test_key"

    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await api_router.route_request(request, api_key)
    
    assert exc_info.value.response.status_code == 400
    assert UPSTREAM_REQUESTS_TOTAL._value == 1
    assert UPSTREAM_REQUESTS_TOTAL._metrics[('test', 'http://error-upstream.com/test', 400)]._value == 1

    config.upstream_services = original_upstream # Restore original config

@pytest.mark.asyncio
async def test_route_request_upstream_connection_error(api_router: APIRouter, mock_httpx_client):
    # Temporarily modify config for predictable upstream
    original_upstream = config.upstream_services.copy()
    config.upstream_services = {"/test": ["http://connection-error-upstream.com/test"]}
    api_router.upstream_services = config.upstream_services
    api_router.service_iterators = {"/test": itertools.cycle(config.upstream_services["/test"])}

    mock_httpx_client.get.return_value.status_code = 200 # Health check passes
    mock_httpx_client.send.side_effect = httpx.RequestError("Connection refused", request=httpx.Request("GET", "http://connection-error-upstream.com/test"))

    request = httpx.Request("GET", "http://gateway.com/api/test/path")
    api_key = "test_key"

    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await api_router.route_request(request, api_key)
    
    assert exc_info.value.response.status_code == 500
    assert "Failed to connect to upstream service" in exc_info.value.message
    assert UPSTREAM_REQUESTS_TOTAL._value == 1
    assert UPSTREAM_REQUESTS_TOTAL._metrics[('test', 'http://connection-error-upstream.com/test', 500)]._value == 1

    config.upstream_services = original_upstream # Restore original config
