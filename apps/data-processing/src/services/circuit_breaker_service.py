import pybreaker
from redis import Redis


redis_client = Redis(decode_responses=True)
db_breaker = pybreaker.CircuitBreaker(
    fail_max=5, 
    reset_timeout=60, 
    state_storage=pybreaker.RedisStorage('failed', redis_client)
)

class CircuitBreaker:
    """A wrapper for the circuit breaker library."""
    
    @staticmethod
    def get_breaker(name: str) -> pybreaker.CircuitBreaker:
        """Returns a named circuit breaker instance."""
        return pybreaker.CircuitBreaker(
            fail_max=5,
            reset_timeout=60,
            state_storage=pybreaker.RedisStorage(name, redis_client)
        )