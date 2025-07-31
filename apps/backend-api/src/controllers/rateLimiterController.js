const rateLimitService = require("../services/rateLimitService");
const { RateLimitViolation, RateLimitMetrics } = require("../models/RateLimit");

class RateLimitController {
  // Get rate limit statistics
  async getStats(req, res) {
    try {
      const { timeframe = 3600000 } = req.query; // Default 1 hour
      const stats = await rateLimitService.getStats(parseInt(timeframe));

      res.json({
        success: true,
        data: stats,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Get stats error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve rate limit statistics",
        message: error.message,
      });
    }
  }

  // Get violations for a specific IP
  async getViolationsByIP(req, res) {
    try {
      const { ip } = req.params;
      const { timeframe = 86400000, page = 1, limit = 50 } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const violations = await RateLimitViolation.getViolationsByIP(
        ip,
        parseInt(timeframe)
      )
        .skip(skip)
        .limit(parseInt(limit));

      const total = await RateLimitViolation.countDocuments({
        ip,
        createdAt: { $gte: new Date(Date.now() - parseInt(timeframe)) },
      });

      res.json({
        success: true,
        data: violations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      console.error("Get violations by IP error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve violations",
        message: error.message,
      });
    }
  }

  // Get violations for a specific user
  async getViolationsByUser(req, res) {
    try {
      const { userId } = req.params;
      const { timeframe = 86400000, page = 1, limit = 50 } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const violations = await RateLimitViolation.getViolationsByUser(
        userId,
        parseInt(timeframe)
      )
        .skip(skip)
        .limit(parseInt(limit));

      const total = await RateLimitViolation.countDocuments({
        userId,
        createdAt: { $gte: new Date(Date.now() - parseInt(timeframe)) },
      });

      res.json({
        success: true,
        data: violations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      console.error("Get violations by user error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve violations",
        message: error.message,
      });
    }
  }

  // Get top violating IPs
  async getTopViolatingIPs(req, res) {
    try {
      const { timeframe = 86400000, limit = 10 } = req.query;
      const since = new Date(Date.now() - parseInt(timeframe));

      const topIPs = await RateLimitViolation.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: "$ip",
            violations: { $sum: 1 },
            lastViolation: { $max: "$createdAt" },
            endpoints: { $addToSet: "$endpoint" },
            methods: { $addToSet: "$method" },
            violationTypes: { $addToSet: "$violationType" },
          },
        },
        { $sort: { violations: -1 } },
        { $limit: parseInt(limit) },
        {
          $project: {
            ip: "$_id",
            violations: 1,
            lastViolation: 1,
            uniqueEndpoints: { $size: "$endpoints" },
            uniqueMethods: { $size: "$methods" },
            violationTypes: 1,
          },
        },
      ]);

      res.json({
        success: true,
        data: topIPs,
        timeframe: parseInt(timeframe),
      });
    } catch (error) {
      console.error("Get top violating IPs error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve top violating IPs",
        message: error.message,
      });
    }
  }

  // Get endpoint violation statistics
  async getEndpointStats(req, res) {
    try {
      const { timeframe = 86400000 } = req.query;
      const since = new Date(Date.now() - parseInt(timeframe));

      const endpointStats = await RateLimitViolation.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              endpoint: "$endpoint",
              method: "$method",
            },
            violations: { $sum: 1 },
            uniqueIPs: { $addToSet: "$ip" },
            uniqueUsers: { $addToSet: "$userId" },
            lastViolation: { $max: "$createdAt" },
          },
        },
        { $sort: { violations: -1 } },
        {
          $project: {
            endpoint: "$_id.endpoint",
            method: "$_id.method",
            violations: 1,
            uniqueIPCount: { $size: "$uniqueIPs" },
            uniqueUserCount: { $size: "$uniqueUsers" },
            lastViolation: 1,
          },
        },
      ]);

      res.json({
        success: true,
        data: endpointStats,
        timeframe: parseInt(timeframe),
      });
    } catch (error) {
      console.error("Get endpoint stats error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve endpoint statistics",
        message: error.message,
      });
    }
  }

  // Add IP to whitelist
  async addToWhitelist(req, res) {
    try {
      const { ip, userId, reason } = req.body;

      if (!ip && !userId) {
        return res.status(400).json({
          success: false,
          error: "Either IP or userId must be provided",
        });
      }

      // This would typically update your configuration or database
      // For now, we'll just log the action
      console.log(
        `Adding to whitelist: IP=${ip}, UserId=${userId}, Reason=${reason}`
      );

      // In a real implementation, you might:
      // 1. Update environment variables
      // 2. Update a database table
      // 3. Update Redis cache
      // 4. Notify other services

      res.json({
        success: true,
        message: "Successfully added to whitelist",
        data: { ip, userId, reason, addedAt: new Date() },
      });
    } catch (error) {
      console.error("Add to whitelist error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to add to whitelist",
        message: error.message,
      });
    }
  }

  // Add IP to blacklist
  async addToBlacklist(req, res) {
    try {
      const { ip, userId, reason } = req.body;

      if (!ip && !userId) {
        return res.status(400).json({
          success: false,
          error: "Either IP or userId must be provided",
        });
      }

      console.log(
        `Adding to blacklist: IP=${ip}, UserId=${userId}, Reason=${reason}`
      );

      res.json({
        success: true,
        message: "Successfully added to blacklist",
        data: { ip, userId, reason, addedAt: new Date() },
      });
    } catch (error) {
      console.error("Add to blacklist error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to add to blacklist",
        message: error.message,
      });
    }
  }

  // Remove from whitelist
  async removeFromWhitelist(req, res) {
    try {
      const { ip, userId } = req.body;

      console.log(`Removing from whitelist: IP=${ip}, UserId=${userId}`);

      res.json({
        success: true,
        message: "Successfully removed from whitelist",
        data: { ip, userId, removedAt: new Date() },
      });
    } catch (error) {
      console.error("Remove from whitelist error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to remove from whitelist",
        message: error.message,
      });
    }
  }

  // Remove from blacklist
  async removeFromBlacklist(req, res) {
    try {
      const { ip, userId } = req.body;

      console.log(`Removing from blacklist: IP=${ip}, UserId=${userId}`);

      res.json({
        success: true,
        message: "Successfully removed from blacklist",
        data: { ip, userId, removedAt: new Date() },
      });
    } catch (error) {
      console.error("Remove from blacklist error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to remove from blacklist",
        message: error.message,
      });
    }
  }

  // Reset rate limits for IP or user
  async resetLimits(req, res) {
    try {
      const { ip, userId } = req.body;
      const identifier = userId ? `user:${userId}` : `ip:${ip}`;

      // Clear rate limit counters
      if (rateLimitService.redis) {
        const keys = await rateLimitService.redis.keys(
          `${rateLimitService.generateKey("*", identifier, "*")}`
        );
        if (keys.length > 0) {
          await rateLimitService.redis.del(...keys);
        }
      }

      // Clear backoff periods
      const backoffKey = rateLimitService.generateKey("backoff", identifier);
      if (rateLimitService.redis) {
        await rateLimitService.redis.del(backoffKey);
      }

      res.json({
        success: true,
        message: "Rate limits reset successfully",
        data: { ip, userId, resetAt: new Date() },
      });
    } catch (error) {
      console.error("Reset limits error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to reset rate limits",
        message: error.message,
      });
    }
  }

  // Get current rate limit status for IP or user
  async getLimitStatus(req, res) {
    try {
      const { ip, userId } = req.query;
      const identifier = userId ? `user:${userId}` : ip ? `ip:${ip}` : null;

      if (!identifier) {
        return res.status(400).json({
          success: false,
          error: "Either IP or userId must be provided",
        });
      }

      // Check current limits and backoff status
      const backoffStatus = await rateLimitService.isInBackoff(identifier);
      const violationCount = await rateLimitService.getViolationCount(
        identifier
      );

      // Check whitelist/blacklist status
      const isWhitelisted = rateLimitService.isWhitelisted(ip, userId);
      const isBlacklisted = rateLimitService.isBlacklisted(ip, userId);

      res.json({
        success: true,
        data: {
          identifier,
          isWhitelisted,
          isBlacklisted,
          backoffStatus,
          violationCount,
          checkedAt: new Date(),
        },
      });
    } catch (error) {
      console.error("Get limit status error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get limit status",
        message: error.message,
      });
    }
  }

  // Export violation data
  async exportViolations(req, res) {
    try {
      const { timeframe = 86400000, format = "json" } = req.query;
      const since = new Date(Date.now() - parseInt(timeframe));

      const violations = await RateLimitViolation.find({
        createdAt: { $gte: since },
      }).sort({ createdAt: -1 });

      if (format === "csv") {
        // Convert to CSV format
        const csv = violations
          .map((v) =>
            [
              v.ip,
              v.userId || "",
              v.endpoint,
              v.method,
              v.violationType,
              v.attemptedRequests,
              v.allowedLimit,
              v.createdAt.toISOString(),
            ].join(",")
          )
          .join("\n");

        const header =
          "IP,UserID,Endpoint,Method,ViolationType,AttemptedRequests,AllowedLimit,Timestamp\n";

        res.set({
          "Content-Type": "text/csv",
          "Content-Disposition":
            "attachment; filename=rate_limit_violations.csv",
        });

        res.send(header + csv);
      } else {
        res.json({
          success: true,
          data: violations,
          count: violations.length,
          timeframe: parseInt(timeframe),
          exportedAt: new Date(),
        });
      }
    } catch (error) {
      console.error("Export violations error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to export violations",
        message: error.message,
      });
    }
  }
}

module.exports = new RateLimitController();
