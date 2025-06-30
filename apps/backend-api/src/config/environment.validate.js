// Environment variables configuration and validation
const dotenv = require('dotenv');
const Joi = require('joi');

// Load environment variables from .env file
const envFound = dotenv.config();
if (envFound.error) {
  throw new Error('⚠️  Could not find .env file  ⚠️');
}

// Define schema for environment variables
const envSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'staging', 'production').required(),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DATABASE_URL: Joi.string().uri().required(),
  MONGODB_URI: Joi.string(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow(''),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  COINGECKO_API_KEY: Joi.string().required(),
  NEWS_API_KEY: Joi.string().required(),
  STARKNET_RPC_URL: Joi.string().uri().required(),
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().required(),
  SMTP_PASSWORD: Joi.string().required(),
  FROM_EMAIL: Joi.string().email().required(),
  FRONTEND_URL: Joi.string().required(),
  ALLOWED_ORIGINS: Joi.string().required(),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
  LOG_FILE: Joi.string().default('logs/app.log'),
}).unknown();

const { value: envVars, error } = envSchema.validate(process.env, { abortEarly: false });
if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

// Ensure sensitive environment variables are never logged
const SENSITIVE_KEYS = [
  'DB_PASSWORD', 'DATABASE_URL', 'REDIS_PASSWORD', 'JWT_SECRET', 'JWT_REFRESH_SECRET',
  'COINGECKO_API_KEY', 'NEWS_API_KEY', 'STARKNET_RPC_URL', 'SMTP_PASSWORD', 'MONGODB_URI',
];

function filterSensitive(obj) {
  const clone = { ...obj };
  SENSITIVE_KEYS.forEach(key => {
    if (clone[key]) clone[key] = '[REDACTED]';
  });
  return clone;
}

// Export validated config
module.exports = {
  port: envVars.PORT,
  nodeEnv: envVars.NODE_ENV,
  db: {
    host: envVars.DB_HOST,
    port: envVars.DB_PORT,
    name: envVars.DB_NAME,
    user: envVars.DB_USER,
    password: envVars.DB_PASSWORD,
    url: envVars.DATABASE_URL,
  },
  redis: {
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD,
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
  },
  apiKeys: {
    coingecko: envVars.COINGECKO_API_KEY,
    news: envVars.NEWS_API_KEY,
    starknet: envVars.STARKNET_RPC_URL,
  },
  email: {
    host: envVars.SMTP_HOST,
    port: envVars.SMTP_PORT,
    user: envVars.SMTP_USER,
    password: envVars.SMTP_PASSWORD,
    from: envVars.FROM_EMAIL,
  },
  cors: {
    frontendUrl: envVars.FRONTEND_URL,
    allowedOrigins: envVars.ALLOWED_ORIGINS.split(','),
  },
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    max: envVars.RATE_LIMIT_MAX_REQUESTS,
  },
  logging: {
    level: envVars.LOG_LEVEL,
    file: envVars.LOG_FILE,
  },
  mongodbUri: envVars.MONGODB_URI,
  filterSensitive,
};
