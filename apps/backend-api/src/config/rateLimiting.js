module.exports = {
  // Default rate limiting settings
  default: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (req) => req.ip,
  },

  // Endpoint-specific rate limits
  endpoints: {
    // Authentication endpoints - stricter limits
    auth: {
      login: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 login attempts per 15 minutes
        skipSuccessfulRequests: true,
        message: "Too many login attempts, please try again later",
      },
      register: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 3, // 3 registration attempts per hour
        message: "Too many registration attempts, please try again later",
      },
      "password-reset": {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 3, // 3 password reset attempts per hour
        message: "Too many password reset attempts, please try again later",
      },
    },

    // API endpoints - moderate limits
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // 1000 requests per 15 minutes for API endpoints
      message: "API rate limit exceeded, please slow down",
    },

    // File upload endpoints - very strict limits
    upload: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // 10 uploads per hour
      message: "Upload rate limit exceeded, please try again later",
    },

    // Search endpoints - moderate limits
    search: {
      windowMs: 60 * 1000, // 1 minute
      max: 30, // 30 searches per minute
      message: "Search rate limit exceeded, please wait before searching again",
    },
  },

  // User tier-based limits
  userTiers: {
    free: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 100, // 100 requests per hour
      message: "Free tier rate limit exceeded. Consider upgrading your plan.",
    },
    premium: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 1000, // 1000 requests per hour
      message: "Premium tier rate limit exceeded",
    },
    enterprise: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10000, // 10000 requests per hour
      message: "Enterprise tier rate limit exceeded",
    },
  },

  // Whitelist/Blacklist settings
  whitelist: {
    ips: process.env.WHITELISTED_IPS
      ? process.env.WHITELISTED_IPS.split(",")
      : [],
    userIds: process.env.WHITELISTED_USERS
      ? process.env.WHITELISTED_USERS.split(",")
      : [],
  },

  blacklist: {
    ips: process.env.BLACKLISTED_IPS
      ? process.env.BLACKLISTED_IPS.split(",")
      : [],
    userIds: process.env.BLACKLISTED_USERS
      ? process.env.BLACKLISTED_USERS.split(",")
      : [],
  },

  // Exponential backoff settings
  backoff: {
    enabled: true,
    baseDelay: 1000, // 1 second base delay
    maxDelay: 300000, // 5 minutes max delay
    multiplier: 2, // exponential multiplier
    jitter: true, // add randomization to prevent thundering herd
  },

  // Redis configuration for distributed rate limiting
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: process.env.REDIS_DB || 0,
    keyPrefix: "rl:", // rate limit key prefix
  },

  // Monitoring settings
  monitoring: {
    enabled: true,
    logViolations: true,
    alertThreshold: 100, // Alert when violations exceed this number per hour
    metricsInterval: 60000, // Collect metrics every minute
  },
};
