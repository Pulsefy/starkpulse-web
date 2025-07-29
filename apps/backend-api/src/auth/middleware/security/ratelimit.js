const { RateLimiterRedis } = require("rate-limiter-flexible");
const redisClient = require("../../../redisClient");

const rateLimiters = {
  login: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: "login_limit",
    points: 5, // 5 attempts
    duration: 60 * 15, // 15 minutes
    blockDuration: 60 * 60, // Block for 1 hour
  }),
  api: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: "api_limit",
    points: 100, // 100 requests
    duration: 60, // 1 minute
  }),
};

const rateLimiter = (type) => async (req, res, next) => {
  try {
    const limiter = rateLimiters[type];
    const key = type === "login" ? req.ip : req.user?.id || req.ip;

    await limiter.consume(key);
    next();
  } catch (error) {
    res.status(429).json({ message: "Too many requests" });
  }
};

module.exports = rateLimiter;
