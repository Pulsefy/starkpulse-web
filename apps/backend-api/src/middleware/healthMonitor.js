/**
 * Health Monitoring Middleware
 * Tracks API performance metrics and response times
 */

const os = require('node:os');
const logger = require('../utils/logger');
const { getRedisClient } = require('../config/redis');

// Metrics storage
const metrics = {
  requestCount: 0,
  responseTimeTotal: 0,
  responseTimeAvg: 0,
  statusCodes: {},
  errors: 0,
  lastCalculated: Date.now(),
};

/**
 * Reset metrics counters (called periodically)
 */
const resetMetrics = () => {
  const now = Date.now();
  const timePeriod = (now - metrics.lastCalculated) / 1000; // in seconds
  
  logger.debug(`Resetting metrics after ${timePeriod.toFixed(2)}s - ` +
    `Processed ${metrics.requestCount} requests with average response time of ${metrics.responseTimeAvg.toFixed(2)}ms`);
  
  metrics.requestCount = 0;
  metrics.responseTimeTotal = 0;
  metrics.responseTimeAvg = 0;
  metrics.statusCodes = {};
  metrics.errors = 0;
  metrics.lastCalculated = now;
};

// Schedule periodic metrics reset (every 5 minutes)
setInterval(resetMetrics, 5 * 60 * 1000);

/**
 * Store API metrics in Redis for dashboard access
 * @param {object} currentMetrics - Current metrics snapshot
 */
const storeMetricsSnapshot = async (currentMetrics) => {
  try {
    const redis = getRedisClient();
    const timestamp = new Date().toISOString();
    
    // Store the metrics with a timestamp as key
    const metricsKey = `metrics:${timestamp}`;
    await redis.set(metricsKey, JSON.stringify({
      ...currentMetrics,
      timestamp,
      systemLoad: os.loadavg(),
      freeMemory: os.freemem(),
      totalMemory: os.totalmem()
    }), 'EX', 24 * 60 * 60); // Store for 24 hours
    
    // Add to the metrics list (limited to most recent 1000 entries)
    await redis.lpush('metrics:recent', metricsKey);
    await redis.ltrim('metrics:recent', 0, 999);
  } catch (error) {
    logger.error('Failed to store metrics snapshot:', error);
  }
};

/**
 * API performance monitoring middleware
 * Tracks request counts, response times, and status codes
 */
const performanceMonitor = (req, res, next) => {
  // Skip monitoring for health check endpoints to avoid skewing metrics
  if (req.path.startsWith('/api/health')) {
    return next();
  }

  const startTime = process.hrtime();
  
  // Track response metrics
  const end = res.end;
  res.end = function() {
    const diff = process.hrtime(startTime);
    const responseTimeMs = (diff[0] * 1e9 + diff[1]) / 1e6;
    
    // Update metrics
    metrics.requestCount++;
    metrics.responseTimeTotal += responseTimeMs;
    metrics.responseTimeAvg = metrics.responseTimeTotal / metrics.requestCount;
    
    // Track status codes
    const statusCode = res.statusCode.toString();
    metrics.statusCodes[statusCode] = (metrics.statusCodes[statusCode] || 0) + 1;
    
    // Track errors
    if (res.statusCode >= 500) {
      metrics.errors++;
    }
    
    // Store metrics snapshot (randomly sample ~5% of requests to avoid overwhelming Redis)
    if (Math.random() < 0.05) {
      storeMetricsSnapshot({ ...metrics });
    }
    
    // Log slow responses
    if (responseTimeMs > 1000) {
      logger.warn(`Slow response: ${req.method} ${req.originalUrl} - ${responseTimeMs.toFixed(2)}ms`);
    }
    
    // Call original end function
    return end.apply(this, arguments);
  };
  
  next();
};

/**
 * Get current performance metrics
 * @returns {object} Current metrics
 */
const getCurrentMetrics = () => {
  return {
    ...metrics,
    uptime: process.uptime(),
    systemLoad: os.loadavg(),
    freeMemory: os.freemem(),
    totalMemory: os.totalmem(),
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  performanceMonitor,
  getCurrentMetrics
};
