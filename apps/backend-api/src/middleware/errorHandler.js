const logger = require('../utils/logger'); // Make sure logger.js exists

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';
  const timestamp = new Date().toISOString();

  // ==========================
  // Mongoose Validation Error
  // ==========================
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((error) => ({
      field: error.path,
      message: error.message,
    }));

    logger.warn('Validation Error', {
      code: 'VALIDATION_ERROR',
      method: req.method,
      url: req.originalUrl,
      errors,
    });

    return res.status(400).json({
      success: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors,
      timestamp,
    });
  }

  // ==========================
  // Mongoose Duplicate Key
  // ==========================
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];

    logger.warn('Duplicate Key Error', {
      code: 'DUPLICATE_KEY',
      field,
      method: req.method,
      url: req.originalUrl,
    });

    return res.status(409).json({
      success: false,
      status: 409,
      code: 'DUPLICATE_KEY',
      message: `${field} already exists`,
      timestamp,
    });
  }

  // ==========================
  // Mongoose Cast Error (e.g., bad ObjectId)
  // ==========================
  if (err.name === 'CastError') {
    logger.warn('Cast Error', {
      code: 'INVALID_ID_FORMAT',
      field: err.path,
      method: req.method,
      url: req.originalUrl,
    });

    return res.status(400).json({
      success: false,
      status: 400,
      code: 'INVALID_ID_FORMAT',
      message: 'Invalid ID format',
      timestamp,
    });
  }

  // ==========================
  // JWT Errors
  // ==========================
  if (err.name === 'JsonWebTokenError') {
    logger.warn('JWT Error', {
      code: 'INVALID_TOKEN',
      message: err.message,
      url: req.originalUrl,
    });

    return res.status(401).json({
      success: false,
      status: 401,
      code: 'INVALID_TOKEN',
      message: 'Invalid token',
      timestamp,
    });
  }

  if (err.name === 'TokenExpiredError') {
    logger.warn('JWT Token Expired', {
      code: 'TOKEN_EXPIRED',
      url: req.originalUrl,
    });

    return res.status(401).json({
      success: false,
      status: 401,
      code: 'TOKEN_EXPIRED',
      message: 'Token expired',
      timestamp,
    });
  }

  // ==========================
  // Default Fallback Error
  // ==========================
  logger.error('Unhandled Error', {
    code: errorCode,
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
  });

  res.status(statusCode).json({
    success: false,
    status: statusCode,
    code: errorCode,
    message: err.message || 'Internal server error',
    timestamp,
  });
};

module.exports = { errorHandler };
