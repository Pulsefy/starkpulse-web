const Redis = require("redis");
const { RateLimitViolation, RateLimitMetrics } = require("../models/RateLimit");
const rateLimitConfig = require("../config/rateLimiting");

class RateLimitService {
  constructor() {
    this.redis = null;
    this.metrics = {
      requests: new Map(),
      violations: new Map(),
      backoffs: new Map(),
    };
    this.initRedis();
  }

  async initRedis() {
    try {
      this.redis = Redis.createClient({
        host: rateLimitConfig.redis.host,
        port: rateLimitConfig.redis.port,
        password: rateLimitConfig.redis.password,
        db: rateLimitConfig.redis.db,
      });

      this.redis.on("error", (err) => {
        console.error("Redis connection error:", err);
      });

      await this.redis.connect();
      console.log("Redis connected for rate limiting");
    } catch (error) {
      console.error("Failed to connect to Redis:", error);
      // Fallback to in-memory storage
      this.redis = null;
    }
  }

  // Generate unique key for rate limiting
  generateKey(prefix, identifier, endpoint = "") {
    return `${rateLimitConfig.redis.keyPrefix}${prefix}:${identifier}:${endpoint}`;
  }

  // Check if IP or user is whitelisted
  isWhitelisted(ip, userId = null) {
    const isIPWhitelisted = rateLimitConfig.whitelist.ips.includes(ip);
    const isUserWhitelisted =
      userId && rateLimitConfig.whitelist.userIds.includes(userId.toString());
    return isIPWhitelisted || isUserWhitelisted;
  }

  // Check if IP or user is blacklisted
  isBlacklisted(ip, userId = null) {
    const isIPBlacklisted = rateLimitConfig.blacklist.ips.includes(ip);
    const isUserBlacklisted =
      userId && rateLimitConfig.blacklist.userIds.includes(userId.toString());
    return isIPBlacklisted || isUserBlacklisted;
  }

  // Sliding window rate limiting implementation
  async checkRateLimit(key, limit, windowMs) {
    try {
      if (this.redis) {
        return await this.checkRateLimitRedis(key, limit, windowMs);
      } else {
        return await this.checkRateLimitMemory(key, limit, windowMs);
      }
    } catch (error) {
      console.error("Rate limit check error:", error);
      return { allowed: true, remaining: limit };
    }
  }

  async checkRateLimitRedis(key, limit, windowMs) {
    const now = Date.now();
    const pipeline = this.redis.pipeline();

    // Remove expired entries
    pipeline.zremrangebyscore(key, 0, now - windowMs);

    // Count current requests in window
    pipeline.zcard(key);

    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);

    // Set expiration
    pipeline.expire(key, Math.ceil(windowMs / 1000));

    const results = await pipeline.exec();
    const currentCount = results[1][1];

    const allowed = currentCount < limit;
    const remaining = Math.max(0, limit - currentCount - 1);

    return {
      allowed,
      remaining,
      reset: new Date(now + windowMs),
      current: currentCount + 1,
    };
  }

  async checkRateLimitMemory(key, limit, windowMs) {
    const now = Date.now();

    if (!this.metrics.requests.has(key)) {
      this.metrics.requests.set(key, []);
    }

    const requests = this.metrics.requests.get(key);

    // Remove expired requests
    const validRequests = requests.filter(
      (timestamp) => now - timestamp < windowMs
    );
    this.metrics.requests.set(key, validRequests);

    const allowed = validRequests.length < limit;
    const remaining = Math.max(0, limit - validRequests.length - 1);

    if (allowed) {
      validRequests.push(now);
    }

    return {
      allowed,
      remaining,
      reset: new Date(now + windowMs),
      current: validRequests.length + (allowed ? 0 : 1),
    };
  }

  // Calculate exponential backoff delay
  calculateBackoffDelay(violations) {
    if (!rateLimitConfig.backoff.enabled) return 0;

    const { baseDelay, maxDelay, multiplier, jitter } = rateLimitConfig.backoff;
    let delay = baseDelay * Math.pow(multiplier, violations - 1);
    delay = Math.min(delay, maxDelay);

    if (jitter) {
      delay = delay * (0.5 + Math.random() * 0.5); // Add 0-50% jitter
    }

    return Math.floor(delay);
  }

  // Check if user/IP is in backoff period
  async isInBackoff(identifier) {
    const key = this.generateKey("backoff", identifier);

    try {
      if (this.redis) {
        const backoffUntil = await this.redis.get(key);
        if (backoffUntil && Date.now() < parseInt(backoffUntil)) {
          return {
            inBackoff: true,
            backoffUntil: new Date(parseInt(backoffUntil)),
          };
        }
      } else {
        const backoffUntil = this.metrics.backoffs.get(identifier);
        if (backoffUntil && Date.now() < backoffUntil) {
          return {
            inBackoff: true,
            backoffUntil: new Date(backoffUntil),
          };
        }
      }
    } catch (error) {
      console.error("Backoff check error:", error);
    }

    return { inBackoff: false };
  }

  // Set backoff period for user/IP
  async setBackoff(identifier, violations) {
    const delay = this.calculateBackoffDelay(violations);
    if (delay === 0) return;

    const backoffUntil = Date.now() + delay;
    const key = this.generateKey("backoff", identifier);

    try {
      if (this.redis) {
        await this.redis.setex(
          key,
          Math.ceil(delay / 1000),
          backoffUntil.toString()
        );
      } else {
        this.metrics.backoffs.set(identifier, backoffUntil);
        // Clean up expired backoffs in memory
        setTimeout(() => {
          this.metrics.backoffs.delete(identifier);
        }, delay);
      }
    } catch (error) {
      console.error("Set backoff error:", error);
    }
  }

  // Get violation count for user/IP
  async getViolationCount(identifier, timeframe = 60 * 60 * 1000) {
    const key = this.generateKey("violations", identifier);

    try {
      if (this.redis) {
        const now = Date.now();
        await this.redis.zremrangebyscore(key, 0, now - timeframe);
        return await this.redis.zcard(key);
      } else {
        const violations = this.metrics.violations.get(identifier) || [];
        const validViolations = violations.filter(
          (timestamp) => Date.now() - timestamp < timeframe
        );
        this.metrics.violations.set(identifier, validViolations);
        return validViolations.length;
      }
    } catch (error) {
      console.error("Get violation count error:", error);
      return 0;
    }
  }

  // Record a rate limit violation
  async recordViolation(req, violationType, limit, current) {
    const identifier = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
    const key = this.generateKey("violations", identifier);
    const now = Date.now();

    try {
      // Record in Redis/Memory
      if (this.redis) {
        await this.redis.zadd(key, now, `${now}-${Math.random()}`);
        await this.redis.expire(key, 24 * 60 * 60); // Keep for 24 hours
      } else {
        if (!this.metrics.violations.has(identifier)) {
          this.metrics.violations.set(identifier, []);
        }
        this.metrics.violations.get(identifier).push(now);
      }

      // Record in database for persistent tracking
      if (rateLimitConfig.monitoring.logViolations) {
        await RateLimitViolation.create({
          ip: req.ip,
          userId: req.user?.id || null,
          endpoint: req.path,
          method: req.method,
          userAgent: req.get("User-Agent"),
          violationType,
          attemptedRequests: current,
          allowedLimit: limit,
          windowMs: rateLimitConfig.default.windowMs,
          metadata: {
            headers: req.headers,
            query: req.query,
          },
        });
      }

      // Check if backoff should be applied
      const violationCount = await this.getViolationCount(identifier);
      if (violationCount > 1) {
        await this.setBackoff(identifier, violationCount);
      }
    } catch (error) {
      console.error("Record violation error:", error);
    }
  }

  // Get rate limit statistics
  async getStats(timeframe = 60 * 60 * 1000) {
    try {
      const dbStats = await RateLimitViolation.getViolationStats(timeframe);

      // Combine with in-memory stats if available
      const stats = {
        timeframe,
        violations: dbStats,
        memoryStats: {
          activeKeys: this.metrics.requests.size,
          activeBackoffs: this.metrics.backoffs.size,
          activeViolations: this.metrics.violations.size,
        },
      };

      return stats;
    } catch (error) {
      console.error("Get stats error:", error);
      return null;
    }
  }

  // Clean up expired entries (memory optimization)
  cleanup() {
    const now = Date.now();

    // Clean expired requests
    for (const [key, requests] of this.metrics.requests.entries()) {
      const validRequests = requests.filter(
        (timestamp) => now - timestamp < rateLimitConfig.default.windowMs
      );
      if (validRequests.length === 0) {
        this.metrics.requests.delete(key);
      } else {
        this.metrics.requests.set(key, validRequests);
      }
    }

    // Clean expired backoffs
    for (const [key, backoffUntil] of this.metrics.backoffs.entries()) {
      if (now >= backoffUntil) {
        this.metrics.backoffs.delete(key);
      }
    }

    // Clean expired violations
    for (const [key, violations] of this.metrics.violations.entries()) {
      const validViolations = violations.filter(
        (timestamp) => now - timestamp < 24 * 60 * 60 * 1000
      );
      if (validViolations.length === 0) {
        this.metrics.violations.delete(key);
      } else {
        this.metrics.violations.set(key, validViolations);
      }
    }
  }
}

module.exports = new RateLimitService();
