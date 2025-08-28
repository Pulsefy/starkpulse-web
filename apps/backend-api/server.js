const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { createProxyMiddleware } = require("http-proxy-middleware");

// Internal modules
const logger = require("./src/utils/logger");
const gatewayRoutes = require("./src/routes/gatewayRoutes");
const healthRoutes = require("./src/routes/health");
const metricsRoutes = require("./src/routes/metrics");
const { limiter, authLimiter } = require("./src/middleware/rateLimiter");
const { errorHandler } = require("./src/middleware/errorHandler");
const { performanceMonitor } = require("./src/middleware/healthMonitor");
const { closeRedisConnection } = require("./src/config/redis");
const { processHealthAlert } = require("./src/services/alertService");
const config = require("./src/config/environment");
// const { validationRouter } = require(".src/routes/validation");
// const { validatorRouter } = require(".src/routes/validators");
// const { contentRouter } = require(".src/routes/content");
// const { governanceRouter } = require(".src/routes/governance");
// const { ValidationNetwork } = require(".src/services/ValidationNetwork");
// const { ConsensusEngine } = require(".src/services/ConsensusEngine");
// const { ReputationSystem } = require(".src/services/ReputationSystem");
const  serverAdapter  = require('./src/jobs/monitor');

// Load environment variables
dotenv.config();

// ==========================
// App Initialization
// ==========================
const app = express();
const monitoringRouter = require('./src/routes/monitoring');
const PORT = config.port || process.env.PORT || 3000;
const DEBUG = process.env.DEBUG === "true"; // enable for logging targets

// ==========================
// Middleware
// ==========================
app.use(helmet());
app.use(compression());
// app.use(limiter);
// Add performance monitoring middleware
app.use(performanceMonitor);

app.use(
  cors({
    origin: config.cors.frontendUrl || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan("combined"));

// ==========================
// MongoDB Connection
// ==========================
// ==========================
// MongoDB Connection
// ==========================
// mongoose
//   .connect(config.mongodbUri, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   })
//   .then(() => logger.info("Connected to MongoDB"))
//   .catch((err) => logger.error("MongoDB connection error:", err));

// ==========================
// Proxy Target Pools
// ==========================
const servicePools = {
  AUTH: ["http://localhost:5001", "http://localhost:5002"],
  USER: ["http://localhost:6001"],
};

const roundRobinCounter = {
  AUTH: 0,
  USER: 0,
};

function getNextTarget(serviceName) {
  const pool = servicePools[serviceName];
  if (!pool || pool.length === 0) {
    console.warn(`No target defined for service: ${serviceName}`);
    return null;
  }

  const index = roundRobinCounter[serviceName];
  roundRobinCounter[serviceName] = (index + 1) % pool.length;
  const target = pool[index];
  if (DEBUG) console.log(`[${serviceName}] → ${target}`);
  return target;
}

// ==========================
// Proxy Routes
// ==========================

// Initialize core services
// const validationNetwork = new ValidationNetwork();
// const consensusEngine = new ConsensusEngine();
// const reputationSystem = new ReputationSystem();

// Make services available to routes
// app.locals.validationNetwork = validationNetwork;
// app.locals.consensusEngine = consensusEngine;
// app.locals.reputationSystem = reputationSystem;

// Routes
// app.use("/api/validation", validationRouter);
// app.use("/api/validators", validatorRouter);
// app.use("/api/content", contentRouter);
// app.use("/api/governance", governanceRouter);

app.use("/api/auth", authLimiter, (req, res, next) => {
  const target = getNextTarget("AUTH");
  if (!target)
    return res.status(503).json({ message: "Auth service unavailable" });

  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: { "^/api/auth": "/" },
    onError: (err, req, res) => {
      console.error("Auth Proxy Error:", err);
      res.status(502).json({ message: "Bad Gateway - Auth Service" });
    },
  })(req, res, next);
});

app.use("/api/user", (req, res, next) => {
  const target = getNextTarget("USER");
  if (!target)
    return res.status(503).json({ message: "User service unavailable" });

  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: { "^/api/user": "/" },
    onError: (err, req, res) => {
      console.error("User Proxy Error:", err);
      res.status(502).json({ message: "Bad Gateway - User Service" });
    },
  })(req, res, next);
});

// ==========================
// Health & Monitoring Routes (always available at /api/health and /api/metrics)
app.use("/api/health", healthRoutes);
app.use("/api/metrics", metricsRoutes);

app.use('/monitoring', monitoringRouter);

app.use("/admin/queues", serverAdapter.getRouter());

// API Routes with Versioning
// app.use("/api", require("./src/routes"));

// Gateway Aggregator Routes
app.use("/gateway", gatewayRoutes);

// ==========================
// Fallback & Errors
// ==========================
app.use(errorHandler);

app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// ==========================
// Graceful Shutdown
// ==========================
const shutdown = () => {
  logger.info("Shutdown signal received. Cleaning up...");

  // Close MongoDB connection
  mongoose.connection.close(() => {
    logger.info("MongoDB connection closed.");

    // Close Redis connection
    closeRedisConnection()
      .then(() => {
        logger.info("All connections closed, exiting process.");
        process.exit(0);
      })
      .catch((err) => {
        logger.error("Error closing Redis connection:", err);
        process.exit(1);
      });
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ==========================
// Start Server
// ==========================
app.listen(PORT, () => {
  logger.info(`🚀 API Gateway running on port ${PORT}`);
  logger.info(
    `🌐 Environment: ${process.env.NODE_ENV || config.nodeEnv || "development"}`
  );
  if (DEBUG) logger.info("🔍 Proxy debug mode is ON");
});

module.exports = app;
