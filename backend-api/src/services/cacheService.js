const redisClient = require("./redisClient");

class CacheService {
  async get(key) {
    const value = await redisClient.get(key);
    if (value) {
      console.log(`Cache hit for key: ${key}`);
      return JSON.parse(value);
    }
    console.log(`Cache miss for key: ${key}`);
    return null;
  }

  async set(key, value, ttlSeconds = 300) {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
    console.log(`Cache set for key: ${key} with TTL: ${ttlSeconds}s`);
  }

  async del(key) {
    await redisClient.del(key);
    console.log(`Cache deleted for key: ${key}`);
  }

  async reset() {
    await redisClient.flushAll();
    console.log("Cache cleared");
  }
}

module.exports = new CacheService();
