const { RateLimitMetrics } = require("../models/RateLimit");
const rateLimitService = require("../services/rateLimitService");

class RateLimitUtils {
  // Collect and store metrics periodically
  static async collectMetrics() {
    try {
      const stats = await rateLimitService.getStats();

      if (stats) {
        await RateLimitMetrics.create({
          timestamp: new Date(),
          totalRequests: stats.memoryStats?.activeKeys || 0,
          blockedRequests:
            stats.violations?.reduce((sum, v) => sum + v.count, 0) || 0,
          uniqueIPs: stats.memoryStats?.activeKeys || 0,
          uniqueUsers: 0, // You can implement user tracking
          averageResponseTime: 0, // You can implement response time tracking
        });
      }
    } catch (error) {
      console.error("Metrics collection error:", error);
    }
  }

  // Start metrics collection interval
  static startMetricsCollection(intervalMs = 60000) {
    console.log(`Starting rate limit metrics collection every ${intervalMs}ms`);

    setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    // Also start cleanup interval
    this.startCleanupInterval();
  }

  // Start cleanup interval for in-memory storage
  static startCleanupInterval(intervalMs = 300000) {
    // 5 minutes
    console.log(`Starting rate limit cleanup every ${intervalMs}ms`);

    setInterval(() => {
      rateLimitService.cleanup();
    }, intervalMs);
  }

  // Get IP from request (handles proxies and load balancers)
  static getClientIP(req) {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.headers["x-real-ip"] ||
      req.headers["x-client-ip"] ||
      "127.0.0.1"
    );
  }

  // Generate rate limit key with custom logic
  static generateRateLimitKey(req, prefix = "rl") {
    const ip = this.getClientIP(req);
    const userId = req.user?.id;
    const endpoint = req.path;

    if (userId) {
      return `${prefix}:user:${userId}:${endpoint}`;
    } else {
      return `${prefix}:ip:${ip}:${endpoint}`;
    }
  }

  // Calculate optimal rate limits based on historical data
  static async calculateOptimalLimits(
    endpoint,
    timeframe = 7 * 24 * 60 * 60 * 1000
  ) {
    try {
      const since = new Date(Date.now() - timeframe);

      // Get historical request patterns
      const metrics = await RateLimitMetrics.find({
        timestamp: { $gte: since },
      }).sort({ timestamp: -1 });

      if (metrics.length === 0) {
        return null;
      }

      // Calculate average and peak request rates
      const requestRates = metrics.map((m) => m.totalRequests);
      const averageRate =
        requestRates.reduce((a, b) => a + b, 0) / requestRates.length;
      const peakRate = Math.max(...requestRates);

      // Suggest limits based on patterns
      const suggestedLimit = Math.ceil(averageRate * 1.5); // 50% buffer above average
      const conservativeLimit = Math.ceil(averageRate * 1.2); // 20% buffer
      const liberalLimit = Math.ceil(peakRate * 0.9); // 90% of peak

      return {
        endpoint,
        currentAverage: Math.round(averageRate),
        currentPeak: peakRate,
        suggested: {
          conservative: conservativeLimit,
          recommended: suggestedLimit,
          liberal: liberalLimit,
        },
        dataPoints: metrics.length,
        timeframe,
      };
    } catch (error) {
      console.error("Calculate optimal limits error:", error);
      return null;
    }
  }

  // Detect and flag suspicious patterns
  static async detectSuspiciousPatterns(timeframe = 60 * 60 * 1000) {
    try {
      const since = new Date(Date.now() - timeframe);

      // Find IPs with high violation rates
      const suspiciousIPs = await RateLimitViolation.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: "$ip",
            violationCount: { $sum: 1 },
            uniqueEndpoints: { $addToSet: "$endpoint" },
            violationTypes: { $addToSet: "$violationType" },
            lastViolation: { $max: "$createdAt" },
          },
        },
        {
          $match: {
            $or: [
              { violationCount: { $gte: 10 } }, // Many violations
              { "uniqueEndpoints.10": { $exists: true } }, // Many different endpoints
            ],
          },
        },
        { $sort: { violationCount: -1 } },
      ]);

      // Find patterns indicating bot behavior
      const botPatterns = await RateLimitViolation.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              ip: "$ip",
              userAgent: "$userAgent",
            },
            count: { $sum: 1 },
            endpoints: { $addToSet: "$endpoint" },
          },
        },
        {
          $match: {
            $or: [
              { userAgent: { $regex: /bot|crawler|spider/i } },
              { count: { $gte: 50 } }, // High request count
            ],
          },
        },
      ]);

      return {
        suspiciousIPs: suspiciousIPs.slice(0, 20), // Top 20
        botPatterns: botPatterns.slice(0, 10), // Top 10
        analyzedTimeframe: timeframe,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("Detect suspicious patterns error:", error);
      return null;
    }
  }

  // Generate rate limiting report
  static async generateReport(timeframe = 24 * 60 * 60 * 1000) {
    try {
      const since = new Date(Date.now() - timeframe);

      // Get overall statistics
      const totalViolations = await RateLimitViolation.countDocuments({
        createdAt: { $gte: since },
      });

      const uniqueIPs = await RateLimitViolation.distinct("ip", {
        createdAt: { $gte: since },
      });

      const uniqueUsers = await RateLimitViolation.distinct("userId", {
        createdAt: { $gte: since },
        userId: { $ne: null },
      });

      // Get top endpoints
      const topEndpoints = await RateLimitViolation.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: "$endpoint",
            violations: { $sum: 1 },
          },
        },
        { $sort: { violations: -1 } },
        { $limit: 10 },
      ]);

      // Get violation trends (hourly breakdown)
      const trends = await RateLimitViolation.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d-%H",
                date: "$createdAt",
              },
            },
            violations: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Detect suspicious patterns
      const suspiciousPatterns = await this.detectSuspiciousPatterns(timeframe);

      return {
        summary: {
          totalViolations,
          uniqueIPs: uniqueIPs.length,
          uniqueUsers: uniqueUsers.length,
          timeframe,
          generatedAt: new Date(),
        },
        topEndpoints,
        trends,
        suspiciousPatterns,
        recommendations: this.generateRecommendations({
          totalViolations,
          uniqueIPs: uniqueIPs.length,
          topEndpoints,
        }),
      };
    } catch (error) {
      console.error("Generate report error:", error);
      return null;
    }
  }

  // Generate recommendations based on patterns
  static generateRecommendations(data) {
    const recommendations = [];

    if (data.totalViolations > 1000) {
      recommendations.push({
        type: "HIGH_VIOLATIONS",
        severity: "high",
        message:
          "High number of rate limit violations detected. Consider implementing stricter limits or reviewing whitelist/blacklist policies.",
        action: "Review rate limiting configuration",
      });
    }

    if (data.uniqueIPs > 100) {
      recommendations.push({
        type: "MANY_UNIQUE_IPS",
        severity: "medium",
        message:
          "Large number of unique IPs violating rate limits. This might indicate distributed attacks.",
        action: "Implement IP-based blocking or CAPTCHA verification",
      });
    }

    if (
      data.topEndpoints?.length > 0 &&
      data.topEndpoints[0].violations > 500
    ) {
      recommendations.push({
        type: "ENDPOINT_HOTSPOT",
        severity: "medium",
        message: `Endpoint ${data.topEndpoints[0]._id} has unusually high violations. Consider endpoint-specific limits.`,
        action: "Implement stricter limits for high-traffic endpoints",
      });
    }

    return recommendations;
  }

  // Validate rate limit configuration
  static validateConfiguration(config) {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!config.windowMs || config.windowMs < 1000) {
      errors.push("windowMs must be at least 1000ms");
    }

    if (!config.max || config.max < 1) {
      errors.push("max must be at least 1");
    }

    // Check for reasonable values
    if (config.windowMs > 24 * 60 * 60 * 1000) {
      warnings.push("windowMs longer than 24 hours might not be practical");
    }

    if (config.max > 10000) {
      warnings.push(
        "Very high rate limits might not provide adequate protection"
      );
    }

    if (config.max < 10 && config.windowMs > 60 * 1000) {
      warnings.push("Low max count with long window may be too restrictive");
    }

    // Validate message field if present
    if (
      config.message &&
      typeof config.message !== "string" &&
      typeof config.message !== "function"
    ) {
      errors.push("message must be a string or function");
    }

    // Validate statusCode if present
    if (
      config.statusCode &&
      (config.statusCode < 400 || config.statusCode > 599)
    ) {
      warnings.push(
        "statusCode should be between 400 and 599 for error responses"
      );
    }

    // Validate handler if present
    if (config.handler && typeof config.handler !== "function") {
      errors.push("handler must be a function");
    }

    // Validate skip if present
    if (config.skip && typeof config.skip !== "function") {
      errors.push("skip must be a function");
    }

    // Validate keyGenerator if present
    if (config.keyGenerator && typeof config.keyGenerator !== "function") {
      errors.push("keyGenerator must be a function");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

module.exports = new RateLimitUtils();
