const rateLimitService = require("../services/rateLimitService");
const rateLimitConfig = require("../config/rateLimiting");

// Generic rate limiter middleware factory
const createRateLimiter = (options = {}) => {
  const config = { ...rateLimitConfig.default, ...options };

  return async (req, res, next) => {
    try {
      // Skip if disabled
      if (config.skip && config.skip(req, res)) {
        return next();
      }

      const ip = req.ip;
      const userId = req.user?.id;

      // Check blacklist first
      if (rateLimitService.isBlacklisted(ip, userId)) {
        await rateLimitService.recordViolation(req, "blacklist", 0, 1);
        return res.status(403).json({
          error: "Access denied",
          type: "blacklist",
          message: "Your IP or account has been blacklisted",
        });
      }

      // Skip rate limiting for whitelisted IPs/users
      if (rateLimitService.isWhitelisted(ip, userId)) {
        return next();
      }

      // Generate rate limit key
      const identifier = userId ? `user:${userId}` : `ip:${ip}`;
      const endpoint = req.path;
      const key = rateLimitService.generateKey("limit", identifier, endpoint);

      // Check if in backoff period
      const backoffCheck = await rateLimitService.isInBackoff(identifier);
      if (backoffCheck.inBackoff) {
        return res.status(429).json({
          error: "Rate limit exceeded - backoff period active",
          type: "backoff",
          message:
            "You are in a temporary backoff period due to excessive requests",
          retryAfter: Math.ceil(
            (backoffCheck.backoffUntil - Date.now()) / 1000
          ),
        });
      }

      // Check rate limit
      const result = await rateLimitService.checkRateLimit(
        key,
        config.max,
        config.windowMs
      );

      // Set rate limit headers
      res.set({
        "X-RateLimit-Limit": config.max,
        "X-RateLimit-Remaining": result.remaining,
        "X-RateLimit-Reset": result.reset
          ? Math.ceil(result.reset.getTime() / 1000)
          : null,
      });

      if (!result.allowed) {
        // Record violation
        await rateLimitService.recordViolation(
          req,
          "rate_limit",
          config.max,
          result.current
        );

        const retryAfter = Math.ceil(config.windowMs / 1000);
        res.set("Retry-After", retryAfter);

        return res.status(429).json({
          error: "Rate limit exceeded",
          type: "rate_limit",
          message:
            config.message || "Too many requests, please try again later",
          limit: config.max,
          current: result.current,
          retryAfter,
          resetTime: result.reset,
        });
      }

      next();
    } catch (error) {
      console.error("Rate limiter error:", error);
      // On error, allow the request to proceed to avoid blocking legitimate traffic
      next();
    }
  };
};

// User-tier based rate limiting
const createUserTierLimiter = () => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(); // Skip if no user context
      }

      const userTier = req.user.tier || "free";
      const tierConfig = rateLimitConfig.userTiers[userTier];

      if (!tierConfig) {
        return next(); // Skip if no tier config
      }

      const identifier = `user:${req.user.id}`;
      const key = rateLimitService.generateKey("tier", identifier);

      const result = await rateLimitService.checkRateLimit(
        key,
        tierConfig.max,
        tierConfig.windowMs
      );

      // Set tier-specific headers
      res.set({
        "X-RateLimit-Tier": userTier,
        "X-RateLimit-Tier-Limit": tierConfig.max,
        "X-RateLimit-Tier-Remaining": result.remaining,
        "X-RateLimit-Tier-Reset": result.reset
          ? Math.ceil(result.reset.getTime() / 1000)
          : null,
      });

      if (!result.allowed) {
        await rateLimitService.recordViolation(
          req,
          "rate_limit",
          tierConfig.max,
          result.current
        );

        return res.status(429).json({
          error: "User tier rate limit exceeded",
          type: "tier_limit",
          message: tierConfig.message,
          tier: userTier,
          limit: tierConfig.max,
          current: result.current,
          retryAfter: Math.ceil(tierConfig.windowMs / 1000),
        });
      }

      next();
    } catch (error) {
      console.error("User tier limiter error:", error);
      next();
    }
  };
};

// Endpoint-specific rate limiters
const authLimiter = createRateLimiter({
  windowMs: rateLimitConfig.endpoints.auth.login.windowMs,
  max: rateLimitConfig.endpoints.auth.login.max,
  message: rateLimitConfig.endpoints.auth.login.message,
  skipSuccessfulRequests:
    rateLimitConfig.endpoints.auth.login.skipSuccessfulRequests,
});

const registrationLimiter = createRateLimiter({
  windowMs: rateLimitConfig.endpoints.auth.register.windowMs,
  max: rateLimitConfig.endpoints.auth.register.max,
  message: rateLimitConfig.endpoints.auth.register.message,
});

const passwordResetLimiter = createRateLimiter({
  windowMs: rateLimitConfig.endpoints.auth["password-reset"].windowMs,
  max: rateLimitConfig.endpoints.auth["password-reset"].max,
  message: rateLimitConfig.endpoints.auth["password-reset"].message,
});

const apiLimiter = createRateLimiter({
  windowMs: rateLimitConfig.endpoints.api.windowMs,
  max: rateLimitConfig.endpoints.api.max,
  message: rateLimitConfig.endpoints.api.message,
});

const uploadLimiter = createRateLimiter({
  windowMs: rateLimitConfig.endpoints.upload.windowMs,
  max: rateLimitConfig.endpoints.upload.max,
  message: rateLimitConfig.endpoints.upload.message,
});

const searchLimiter = createRateLimiter({
  windowMs: rateLimitConfig.endpoints.search.windowMs,
  max: rateLimitConfig.endpoints.search.max,
  message: rateLimitConfig.endpoints.search.message,
});

// Global rate limiter (apply to all routes)
const globalLimiter = createRateLimiter(rateLimitConfig.default);

// Adaptive rate limiter that adjusts based on server load
const createAdaptiveLimiter = (baseConfig) => {
  return async (req, res, next) => {
    try {
      // Get current server metrics (you can implement this based on your monitoring)
      const serverLoad = await getServerLoad(); // Implement this function

      // Adjust limits based on server load
      let adjustedMax = baseConfig.max;
      if (serverLoad > 0.8) {
        adjustedMax = Math.floor(baseConfig.max * 0.5); // Reduce by 50% under high load
      } else if (serverLoad > 0.6) {
        adjustedMax = Math.floor(baseConfig.max * 0.75); // Reduce by 25% under medium load
      }

      const adaptiveConfig = { ...baseConfig, max: adjustedMax };
      const limiter = createRateLimiter(adaptiveConfig);

      return limiter(req, res, next);
    } catch (error) {
      console.error("Adaptive limiter error:", error);
      // Fall back to regular limiter
      const limiter = createRateLimiter(baseConfig);
      return limiter(req, res, next);
    }
  };
};

// Placeholder function for server load - implement based on your needs
async function getServerLoad() {
  // This could check CPU usage, memory usage, response times, etc.
  // For now, return a mock value
  return Math.random(); // Returns 0-1
}

// Request throttling middleware (delays requests instead of blocking)
const createThrottler = (options = {}) => {
  const { delayMs = 1000, maxDelay = 10000 } = options;

  return async (req, res, next) => {
    try {
      const ip = req.ip;
      const userId = req.user?.id;
      const identifier = userId ? `user:${userId}` : `ip:${ip}`;

      // Get current violation count
      const violations = await rateLimitService.getViolationCount(identifier);

      if (violations > 0) {
        const delay = Math.min(delayMs * violations, maxDelay);

        // Add delay
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Set throttling headers
        res.set({
          "X-Throttle-Delay": delay,
          "X-Throttle-Violations": violations,
        });
      }

      next();
    } catch (error) {
      console.error("Throttler error:", error);
      next();
    }
  };
};

// Circuit breaker pattern for rate limiting
const createCircuitBreaker = (options = {}) => {
  const {
    failureThreshold = 10,
    recoveryTimeout = 60000,
    monitoringPeriod = 60000,
  } = options;

  let failures = 0;
  let lastFailureTime = 0;
  let state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN

  return async (req, res, next) => {
    const now = Date.now();

    // Reset failure count after monitoring period
    if (now - lastFailureTime > monitoringPeriod) {
      failures = 0;
    }

    // Check circuit breaker state
    if (state === "OPEN") {
      if (now - lastFailureTime > recoveryTimeout) {
        state = "HALF_OPEN";
      } else {
        return res.status(503).json({
          error: "Service temporarily unavailable",
          type: "circuit_breaker",
          message: "Circuit breaker is open due to excessive failures",
          retryAfter: Math.ceil(
            (recoveryTimeout - (now - lastFailureTime)) / 1000
          ),
        });
      }
    }

    // Handle request
    try {
      await new Promise((resolve, reject) => {
        const originalSend = res.send;

        res.send = function (data) {
          if (res.statusCode >= 400) {
            failures++;
            lastFailureTime = now;

            if (failures >= failureThreshold) {
              state = "OPEN";
            }

            reject(new Error(`HTTP ${res.statusCode}`));
          } else {
            if (state === "HALF_OPEN") {
              state = "CLOSED";
              failures = 0;
            }
            resolve();
          }

          return originalSend.call(this, data);
        };

        next();
      });
    } catch (error) {
      // Error handled by response interceptor
    }
  };
};

module.exports = {
  createRateLimiter,
  createUserTierLimiter,
  createAdaptiveLimiter,
  createThrottler,
  createCircuitBreaker,
  globalLimiter,
  authLimiter,
  registrationLimiter,
  passwordResetLimiter,
  apiLimiter,
  uploadLimiter,
  searchLimiter,
};
