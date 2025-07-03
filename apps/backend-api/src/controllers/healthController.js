/**
 * Health check controller
 * Provides endpoints for basic and detailed health checks of the system
 */

const mongoose = require('mongoose');
const axios = require('axios');
const os = require('node:os');
const { execSync } = require('node:child_process');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Basic health check - quick status check
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} Basic health status
 */
const getBasicHealth = (req, res) => {
  try {
    const status = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'starkpulse-api',
      version: process.env.npm_package_version || '1.0.0',
    };

    res.status(200).json(status);
  } catch (error) {
    logger.error('Error in basic health check:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Error checking system health',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Detailed health check - includes dependencies and system metrics
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} Detailed health status
 */
const getDetailedHealth = async (req, res) => {
  try {
    // Start time to measure endpoint response time
    const startTime = process.hrtime();

    // MongoDB connection check
    let dbStatus = 'UNKNOWN';
    let dbLatency = 0;
    try {
      const dbStartTime = process.hrtime();
      const dbState = mongoose.connection.readyState;
      dbStatus = dbState === 1 ? 'OK' : 'ERROR';
      dbLatency = getHrTimeDurationInMs(dbStartTime);
    } catch (error) {
      logger.error('MongoDB health check failed:', error);
      dbStatus = 'ERROR';
    }

    // Redis connection check
    let redisStatus = 'UNKNOWN';
    let redisLatency = 0;
    try {
      const redis = getRedisClient();
      const redisStartTime = process.hrtime();
      await redis.ping();
      redisStatus = 'OK';
      redisLatency = getHrTimeDurationInMs(redisStartTime);
    } catch (error) {
      logger.error('Redis health check failed:', error);
      redisStatus = 'ERROR';
    }

    // External API checks
    const externalServices = await checkExternalServices();

    // System metrics
    const systemMetrics = getSystemMetrics();

    // Calculate total response time
    const totalResponseTime = getHrTimeDurationInMs(startTime);

    const healthStatus = {
      status: dbStatus === 'OK' && redisStatus === 'OK' ? 'OK' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'starkpulse-api',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      responseTime: `${totalResponseTime.toFixed(2)}ms`,
      dependencies: {
        database: {
          status: dbStatus,
          latency: `${dbLatency.toFixed(2)}ms`,
          type: 'MongoDB',
        },
        cache: {
          status: redisStatus,
          latency: `${redisLatency.toFixed(2)}ms`,
          type: 'Redis',
        },
        externalServices,
      },
      system: systemMetrics,
    };

    // Log health check result
    if (healthStatus.status !== 'OK') {
      logger.warn('Health check showing degraded status:', healthStatus);
    }

    res.status(healthStatus.status === 'OK' ? 200 : 503).json(healthStatus);
  } catch (error) {
    logger.error('Error in detailed health check:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Error checking system health',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Check external services health
 * @returns {object} Status of external services
 */
const checkExternalServices = async () => {
  const services = [
    { name: 'news-api', url: process.env.NEWS_API_URL },
    { name: 'crypto-price-api', url: process.env.CRYPTO_PRICE_API_URL },
    { name: 'starknet-api', url: process.env.STARKNET_API_URL }
  ];

  const results = {};

  for (const service of services) {
    if (!service.url) {
      results[service.name] = { status: 'UNKNOWN', message: 'URL not configured' };
      continue;
    }

    try {
      const startTime = process.hrtime();
      // Add a timeout to prevent hanging on slow services
      const response = await axios.get(service.url, { timeout: 3000 });
      const latency = getHrTimeDurationInMs(startTime);
      
      results[service.name] = {
        status: response.status >= 200 && response.status < 300 ? 'OK' : 'ERROR',
        latency: `${latency.toFixed(2)}ms`,
        statusCode: response.status
      };
    } catch (error) {
      logger.error(`Error checking ${service.name}:`, error.message);
      results[service.name] = { 
        status: 'ERROR', 
        message: error.response?.status ? `HTTP ${error.response.status}` : error.message 
      };
    }
  }

  return results;
};

/**
 * Get system metrics
 * @returns {object} System metrics
 */
const getSystemMetrics = () => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return {
    memory: {
      total: formatBytes(totalMem),
      free: formatBytes(freeMem),
      used: formatBytes(usedMem),
      percentUsed: `${((usedMem / totalMem) * 100).toFixed(2)}%`,
    },
    cpu: {
      loadAvg: os.loadavg(),
      cores: os.cpus().length,
      model: os.cpus()[0].model,
      platform: os.platform(),
    },
    diskSpace: getDiskSpace(),
  };
};

/**
 * Get disk space usage
 * @returns {object} Disk space metrics
 */
const getDiskSpace = () => {
  try {
    // Note: This is Unix-specific - would need adaptation for Windows
    const diskData = execSync('df -h / | tail -1').toString().split(/\s+/);
    return {
      total: diskData[1],
      used: diskData[2],
      free: diskData[3],
      percentUsed: diskData[4],
    };
  } catch (error) {
    logger.error('Error getting disk space:', error);
    return { error: 'Unable to retrieve disk information' };
  }
};

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / (k ** i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Get duration in milliseconds from high-resolution time
 * @param {Array} startTime - Start time from process.hrtime()
 * @returns {number} Duration in milliseconds
 */
const getHrTimeDurationInMs = (startTime) => {
  const diff = process.hrtime(startTime);
  return (diff[0] * 1e9 + diff[1]) / 1e6;
};

module.exports = {
  getBasicHealth,
  getDetailedHealth,
};
