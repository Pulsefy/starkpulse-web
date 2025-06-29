module.exports = (req, res, next) => {
  const event = {
    path: req.originalUrl,
    method: req.method,
    userId: req.user?.id || null,
    timestamp: new Date(),
    userAgent: req.headers['user-agent'],
  };

  console.log('Analytics collected:', event);
  next();
};