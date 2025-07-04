const redisClient = require("./redisClient");

class CacheService {
  constructor() {
    this.client = redisClient;
  }

  async get(key) {
    const value = await this.client.get(key);
    if (value) {
      await this.client.incr("cache:hits");
      console.log(`Cache hit for key: ${key}`);
      return JSON.parse(value);
    }
    await this.client.incr("cache:misses");
    console.log(`Cache miss for key: ${key}`);
    return null;
  }

  async set(key, value, ttlSeconds = 300) {
    await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
    console.log(`Cache set for key: ${key} with TTL: ${ttlSeconds}s`);
  }

  async del(key) {
    await this.client.del(key);
    console.log(`Cache deleted for key: ${key}`);
  }

  async reset() {
    await this.client.flushAll();
    console.log("Cache cleared");
  }

  async stats() {
    const hits = await this.client.get("cache:hits");
    const misses = await this.client.get("cache:misses");
    return {
      hits: Number(hits || 0),
      misses: Number(misses || 0),
    };
  }

  async preload(key, fetchFn, ttl = 300) {
    const data = await fetchFn();
    await this.set(key, data, ttl);
    console.log(`Cache preloaded for key: ${key}`);
  }

  async exists(key) {
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  async keys(pattern = "*") {
    return await this.client.keys(pattern);
  }
}

module.exports = new CacheService();
