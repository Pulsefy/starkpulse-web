const express = require("express");
const router = express.Router();
const rateLimitController = require("../controllers/rateLimitController");
const { apiLimiter } = require("../middleware/rateLimiter");

// Apply API rate limiting to admin routes
router.use(apiLimiter);

// Authentication middleware (you should implement this based on your auth system)
const requireAuth = (req, res, next) => {
  // Implement your authentication logic here
  // For example, check JWT token, session, etc.
  if (!req.user || !req.user.isAdmin) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized access",
    });
  }
  next();
};

// Apply authentication to all admin routes
router.use(requireAuth);

// Statistics and monitoring routes
router.get("/stats", rateLimitController.getStats);
router.get("/violations/ip/:ip", rateLimitController.getViolationsByIP);
router.get("/violations/user/:userId", rateLimitController.getViolationsByUser);
router.get("/violations/top-ips", rateLimitController.getTopViolatingIPs);
router.get("/violations/endpoints", rateLimitController.getEndpointStats);
router.get("/violations/export", rateLimitController.exportViolations);

// Management routes
router.post("/whitelist/add", rateLimitController.addToWhitelist);
router.post("/blacklist/add", rateLimitController.addToBlacklist);
router.delete("/whitelist/remove", rateLimitController.removeFromWhitelist);
router.delete("/blacklist/remove", rateLimitController.removeFromBlacklist);

// Utility routes
router.post("/reset", rateLimitController.resetLimits);
router.get("/status", rateLimitController.getLimitStatus);

module.exports = router;
