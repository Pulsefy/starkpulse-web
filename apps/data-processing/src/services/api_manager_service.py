import aiohttp
import json
from redis import Redis
from src.config import Config 
from .rate_limiter_service import RateLimiter
from .circuit_breaker_service import CircuitBreaker

class ApiManagerService:
   def __init__(self, config: Config):
        self.session = aiohttp.ClientSession()
        self.redis_client = Redis.from_url(config.redis_url, decode_responses=True)
        # Use the providers dictionary from the config object
        self.providers = config.api_providers 
        self.health_status = {provider: "healthy" for provider in self.providers}
async def close_session(self):
            await self.session.close()

async def make_request(self, data_type: str, endpoint: str, params: dict = None):

        provider_config = self.providers.get(data_type)
        if not provider_config:
            raise ValueError(f"No provider configured for data type: {data_type}")
            
        
        response = await self._attempt_request("primary", data_type, endpoint, params)
        
      
        if response is None:
            print(f"INFO: Primary provider for {data_type} failed. Attempting failover.")
            response = await self._attempt_request("failover", data_type, endpoint, params)

        if response is None:
            self.health_status[data_type] = "unhealthy"
            raise ConnectionError(f"All providers for {data_type} failed.")
        
        self.health_status[data_type] = "healthy"
        return response

async def _attempt_request(self, provider_type: str, data_type: str, endpoint: str, params: dict):
        config = self.providers[data_type].get(provider_type)
        if not config:
            return None


        cache_key = f"cache:{data_type}:{endpoint}:{json.dumps(params, sort_keys=True)}"
        cached_response = self.redis_client.get(cache_key)
        if cached_response:
            print(f"INFO: Serving response from cache for key: {cache_key}")
            return json.loads(cached_response)

   
        rate_limiter = RateLimiter(self.redis_client, config["rate_limit"], 60) # per minute
        if await rate_limiter.is_rate_limited(f"{data_type}_{provider_type}"):
            print(f"ERROR: Rate limit exceeded for {data_type}_{provider_type}")
            return None

       
        breaker = CircuitBreaker.get_breaker(f"{data_type}_{provider_type}")
        
        try:
            @breaker
            async def protected_call():
                async with self.session.get(f"{config['base_url']}{endpoint}", params=params, headers={"X-API-KEY": config["api_key"]}) as resp:
                    resp.raise_for_status()
                    data = await resp.json()
                    
                    # Log usage and cost
                    self._log_usage(data_type, provider_type, config["cost_per_call"])
                    
                    # Set cache
                    self.redis_client.set(cache_key, json.dumps(data), ex=3600) # Cache for 1 hour
                    
                    return data
            return await protected_call()
        
        except aiohttp.ClientError as e:
            print(f"ERROR: HTTP request failed for {data_type}_{provider_type}: {e}")
            return None
        except pybreaker.CircuitBreakerError as e:
            print(f"ERROR: Circuit open for {data_type}_{provider_type}: {e}")
            return None

def _log_usage(self, data_type: str, provider_type: str, cost: float):
       
        pipe = self.redis_client.pipeline()
        pipe.hincrby("api_usage:calls", f"{data_type}:{provider_type}", 1)
        pipe.hincrbyfloat("api_usage:cost", f"{data_type}:{provider_type}", cost)
        pipe.execute()
        print(f"INFO: Logged usage for {data_type}_{provider_type}. Cost: ${cost}")

def get_api_health(self):

        return self.health_status

def get_usage_report(self):
       
        calls = self.redis_client.hgetall("api_usage:calls")
        costs = self.redis_client.hgetall("api_usage:cost")
        return {"total_calls": calls, "total_cost": costs}

# Example Usage
async def main():
    manager = ApiManagerService()
    

    try:
        weather_data = await manager.make_request("weather_api", "forecast", {"location": "Abuja"})
        print("Weather Data:", weather_data)
    except Exception as e:
        print(e)
        
    # Get reports
    print("Health Status:", manager.get_api_health())
    print("Usage Report:", manager.get_usage_report())

    await manager.close_session()

# if __name__ == "__main__":
#     import asyncio
#     asyncio.run(main())