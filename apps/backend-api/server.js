// ✅ Updated server.js with centralized auth, analytics logging, dynamic health checks
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const http = require("http");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { createProxyMiddleware } = require("http-proxy-middleware");

const authRoutes = require("./src/routes/auth");
const userRoutes = require("./src/routes/users");
const alertRoutes = require("./routes/alerts");
const MonitoringService = require("./services/MonitoringService");
const { setupWebSocket } = require("./utils/websocket");
const alertLimiter = require("./middleware/alertLimiter");
const logger = require("./src/utils/logger");
const gatewayRoutes = require("./src/routes/gatewayRoutes");
const { limiter, authLimiter } = require("./src/middleware/rateLimiter");
const { errorHandler } = require("./src/middleware/errorHandler");
const authenticate = require("./src/middleware/authenticate");
const analyticsLogger = require("./src/middleware/analyticsLogger");
const config = require("./src/config/environment");

// ==========================
// App Initialization
// ==========================
dotenv.config();
const app = express();
const PORT = config.port || process.env.PORT || 3000;
const DEBUG = process.env.DEBUG === "true";

// ==========================
// Middleware
// ==========================
app.use(helmet());
app.use(compression());
app.use(limiter); // global rate limiter
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
app.use(authenticate); // centralized auth middleware
app.use(analyticsLogger); // logs each request for analytics

// ==========================
// MongoDB Connection
// ==========================
mongoose
  .connect(config.mongodbUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

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
    console.warn(`⚠️ No target defined for service: ${serviceName}`);
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
app.use(
  "/api/auth",
  authLimiter,
  (req, res, next) => {
    const target = getNextTarget("AUTH");
    if (!target) return res.status(503).json({ message: "Auth service unavailable" });

    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: { "^/api/auth": "/" },
      onError: (err, req, res) => {
        console.error("Auth Proxy Error:", err);
        res.status(502).json({ message: "Bad Gateway - Auth Service" });
      },
    })(req, res, next);
  }
);

app.use(
  "/api/user",
  (req, res, next) => {
    const target = getNextTarget("USER");
    if (!target) return res.status(503).json({ message: "User service unavailable" });

    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: { "^/api/user": "/" },
      onError: (err, req, res) => {
        console.error("User Proxy Error:", err);
        res.status(502).json({ message: "Bad Gateway - User Service" });
      },
    })(req, res, next);
  }
);

// ==========================
// Gateway Aggregator Routes
// ==========================
app.use("/api", gatewayRoutes);

// ==========================
// Health Check
// ==========================
app.get("/api/health", async (req, res) => {
  const services = Object.keys(servicePools);
  const health = {};

  await Promise.all(
    services.map(async (key) => {
      const target = getNextTarget(key);
      try {
        const response = await fetch(`${target}/health`);
        health[key] = response.ok ? "Healthy" : "Unhealthy";
      } catch (err) {
        health[key] = "Unreachable";
      }
    })
  );

  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: health,
  });
});

// ==========================
// Fallback & Error Handling
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
  console.log("\n🛑 Shutdown signal received. Cleaning up...");
  mongoose.connection.close(() => {
    console.log("🧹 MongoDB connection closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ==========================
// Start Server
// ==========================
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 API Gateway running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
    if (DEBUG) console.log("🔍 Proxy debug mode is ON");
  });
}

module.exports = app;
