/**
 * Redis configuration
 * Manages Redis client connections
 */

const dotenv = require('dotenv');
const logger = require('../utils/logger');

// Load environment variables
dotenv.config();

// Redis connection settings
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let redisClient = null;

/**
 * Initialize Redis client
 * @returns {object} Redis client instance
 */
const initRedisClient = () => {
  try {
    // Mock Redis client for development/testing if no actual Redis is available
    // This allows the application to function without Redis in development
    // In production, use an actual Redis client like 'redis' or 'ioredis'
    if (process.env.NODE_ENV === 'development' && !process.env.REDIS_URL) {
      logger.warn('Using mock Redis client for development');
      return {
        ping: async () => 'PONG',
        get: async () => null,
        set: async () => 'OK',
        on: () => {},
        connect: async () => {},
        quit: async () => {},
      };
    }
    
    // In a real implementation, you would use the Redis client library
    // For example:
    // const { createClient } = require('redis');
    // const client = createClient({ url: REDIS_URL });
    // client.on('error', (err) => logger.error('Redis Client Error', err));
    // await client.connect();
    // return client;
    
    // For now, return our mock client for all environments
    return {
      ping: async () => 'PONG',
      get: async (key) => null,
      set: async (key, value) => 'OK',
      on: () => {},
      connect: async () => {},
      quit: async () => {},
    };
  } catch (error) {
    logger.error('Failed to initialize Redis client:', error);
    throw error;
  }
};

/**
 * Get Redis client instance (singleton pattern)
 * @returns {object} Redis client
 */
const getRedisClient = () => {
  if (!redisClient) {
    redisClient = initRedisClient();
    logger.info('Redis client initialized');
  }
  return redisClient;
};

/**
 * Close Redis connection
 */
const closeRedisConnection = async () => {
  try {
    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
  }
};

module.exports = {
  getRedisClient,
  closeRedisConnection,
};
