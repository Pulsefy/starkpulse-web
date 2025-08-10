import time
from redis import Redis

class RateLimiter:
    def __init__(self, client: Redis, requests: int, per_seconds: int):
        self.client = client
        self.requests = requests
        self.per_seconds = per_seconds

    async def is_rate_limited(self, key: str) -> bool:
        
        key = f"rate_limit:{key}"
        

        pipeline = self.client.pipeline()
        pipeline.incr(key)
        pipeline.ttl(key)
        count, ttl = pipeline.execute()

        if ttl == -1: 
            self.client.expire(key, self.per_seconds)

       
        if count > (self.requests * 0.8):
           
            print(f"WARN: High usage for key {key}. Usage: {count}/{self.requests}")

        return count > self.requests