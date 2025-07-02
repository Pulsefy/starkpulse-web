const mongoose = require("mongoose");

const rateLimitViolationSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
    },
    method: {
      type: String,
      required: true,
    },
    userAgent: String,
    violationType: {
      type: String,
      enum: ["rate_limit", "throttle", "blacklist"],
      required: true,
    },
    attemptedRequests: {
      type: Number,
      required: true,
    },
    allowedLimit: {
      type: Number,
      required: true,
    },
    windowMs: Number,
    backoffUntil: Date,
    isResolved: {
      type: Boolean,
      default: false,
    },
    resolvedAt: Date,
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
rateLimitViolationSchema.index({ ip: 1, createdAt: -1 });
rateLimitViolationSchema.index({ userId: 1, createdAt: -1 });
rateLimitViolationSchema.index({ endpoint: 1, createdAt: -1 });
rateLimitViolationSchema.index({ violationType: 1, createdAt: -1 });
rateLimitViolationSchema.index({ createdAt: -1 });

// TTL index to automatically remove old violation records after 30 days
rateLimitViolationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 2592000 }
);

// Static methods
rateLimitViolationSchema.statics.getViolationsByIP = function (
  ip,
  timeframe = 24 * 60 * 60 * 1000
) {
  const since = new Date(Date.now() - timeframe);
  return this.find({
    ip,
    createdAt: { $gte: since },
  }).sort({ createdAt: -1 });
};

rateLimitViolationSchema.statics.getViolationsByUser = function (
  userId,
  timeframe = 24 * 60 * 60 * 1000
) {
  const since = new Date(Date.now() - timeframe);
  return this.find({
    userId,
    createdAt: { $gte: since },
  }).sort({ createdAt: -1 });
};

rateLimitViolationSchema.statics.getViolationStats = function (
  timeframe = 60 * 60 * 1000
) {
  const since = new Date(Date.now() - timeframe);
  return this.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: "$violationType",
        count: { $sum: 1 },
        uniqueIPs: { $addToSet: "$ip" },
        uniqueUsers: { $addToSet: "$userId" },
      },
    },
    {
      $project: {
        violationType: "$_id",
        count: 1,
        uniqueIPCount: { $size: "$uniqueIPs" },
        uniqueUserCount: { $size: "$uniqueUsers" },
      },
    },
  ]);
};

const rateLimitMetricsSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    endpoint: String,
    totalRequests: Number,
    blockedRequests: Number,
    uniqueIPs: Number,
    uniqueUsers: Number,
    averageResponseTime: Number,
    topIPs: [
      {
        ip: String,
        requests: Number,
      },
    ],
    topEndpoints: [
      {
        endpoint: String,
        requests: Number,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically remove old metrics after 7 days
rateLimitMetricsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 });

module.exports = {
  RateLimitViolation: mongoose.model(
    "RateLimitViolation",
    rateLimitViolationSchema
  ),
  RateLimitMetrics: mongoose.model("RateLimitMetrics", rateLimitMetricsSchema),
};
