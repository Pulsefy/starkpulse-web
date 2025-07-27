from fastapi import Request, HTTPException, status
from typing import Optional
import structlog
import redis.asyncio as redis

from config import config
from database.redis_client import get_redis_client

logger = structlog.get_logger(__name__)

class AuthMiddleware:
    def __init__(self, redis_client: redis.Redis):
        self.redis_client = redis_client
        logger.info("AuthMiddleware initialized.")

    async def authenticate_api_key(self, request: Request) -> str:
        """
        Authenticates API key from headers.
        In a real system, this would involve more robust validation (e.g., database lookup, expiry).
        """
        api_key = request.headers.get("X-API-Key")
        if not api_key:
            logger.warning("API Key missing in request headers.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API Key missing"
            )
        
        # For demonstration, check against in-memory config.api_keys
        if api_key not in config.api_keys:
            logger.warning("Invalid API Key provided.", api_key_prefix=api_key[:8])
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid API Key"
            )
        
        logger.debug("API Key authenticated successfully.", api_key_prefix=api_key[:8])
        return api_key

    # Placeholder for JWT authentication if needed for internal services
    # async def authenticate_jwt(self, request: Request) -> str:
    #     token = request.headers.get("Authorization")
    #     if not token or not token.startswith("Bearer "):
    #         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token missing")
    #     
    #     token = token.split(" ")[1]
    #     try:
    #         payload = jwt.decode(token, config.jwt_secret_key, algorithms=[config.jwt_algorithm])
    #         user_id: str = payload.get("sub")
    #         if user_id is None:
    #             raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    #         return user_id
    #     except JWTError:
    #         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid token")
