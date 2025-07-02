const rateLimit = require("express-rate-limit");

const alertLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 alert operations per windowMs
  message: {
    success: false,
    message: "Too many alert operations. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = alertLimiter;
