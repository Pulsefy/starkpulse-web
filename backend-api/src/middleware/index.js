// Export all middleware
module.exports = {
  auth: require('./auth'),
  validation: require('./validation'),
  errorHandler: require('./errorHandler'),
  rateLimiter: require('./rateLimiter'),
  cors: require('./cors'),
  logger: require('./logger'),
  security: require('./security'),
};
