import rateLimit from "express-rate-limit"

// General analytics rate limiting
export const analyticsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many analytics requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Stress test rate limiting (more restrictive)
export const stressTestRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit stress tests to 10 per hour
  message: {
    error: "Too many stress test requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Real-time updates rate limiting
export const realTimeRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 1 request per second
  message: {
    error: "Too many real-time update requests",
  },
  standardHeaders: true,
  legacyHeaders: false,
})
