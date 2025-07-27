import pytest
from fastapi import Request, HTTPException, status
from unittest.mock import AsyncMock

from core.auth_middleware import AuthMiddleware
from config import config

@pytest.fixture
def mock_redis_client():
    return AsyncMock()

@pytest.fixture
def auth_middleware(mock_redis_client):
    return AuthMiddleware(mock_redis_client)

@pytest.mark.asyncio
async def test_authenticate_api_key_success(auth_middleware: AuthMiddleware):
    api_key = list(config.api_keys.keys())[0] # Get a valid API key
    request = Request(scope={"type": "http", "headers": [(b"x-api-key", api_key.encode())]})
    
    authenticated_key = await auth_middleware.authenticate_api_key(request)
    assert authenticated_key == api_key

@pytest.mark.asyncio
async def test_authenticate_api_key_missing(auth_middleware: AuthMiddleware):
    request = Request(scope={"type": "http", "headers": []})
    
    with pytest.raises(HTTPException) as exc_info:
        await auth_middleware.authenticate_api_key(request)
    
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert exc_info.value.detail == "API Key missing"

@pytest.mark.asyncio
async def test_authenticate_api_key_invalid(auth_middleware: AuthMiddleware):
    invalid_api_key = "INVALID_KEY"
    request = Request(scope={"type": "http", "headers": [(b"x-api-key", invalid_api_key.encode())]})
    
    with pytest.raises(HTTPException) as exc_info:
        await auth_middleware.authenticate_api_key(request)
    
    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc_info.value.detail == "Invalid API Key"
