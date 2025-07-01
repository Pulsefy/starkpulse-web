
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const dotenv = require("dotenv");


const logger = require('./src/utils/logger');

const mongoose = require("mongoose");
const gatewayRoutes = require('./src/routes/gatewayRoutes');

const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const helmet = require("helmet")
const compression = require("compression")
const morgan = require("morgan")
const { limiter, authLimiter } = require("./src/middleware/rateLimiter")
const config = require("./src/config/environment")




const { createProxyMiddleware } = require("http-proxy-middleware");

// ==========================
// App Initialization
// ==========================
const app = express()
const PORT = config.port || 3000


const { limiter, authLimiter } = require("./src/middleware/rateLimiter");
const { errorHandler } = require("./src/middleware/errorHandler");

dotenv.config();

// ==========================
// App Initialization
// ==========================

const app = express();
app.use('/api', gatewayRoutes);
const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DEBUG === "true"; // enable for logging targets

app.use(limiter)


// ==========================
// Middleware
// ==========================
app.use(helmet());
app.use(compression());
app.use(limiter);

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
mongoose
  .connect(config.mongodbUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))

  .catch((err) => console.error("MongoDB connection error:", err));

  .catch((err) => console.error("MongoDB connection error:", err))



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

// Health Check
// ==========================
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

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
  console.log("Shutdown signal received. Cleaning up...");
  mongoose.connection.close(() => {
    console.log("MongoDB connection closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ==========================
// Start Server
// ==========================
app.listen(PORT, () => {

  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
  if (DEBUG) console.log("🔍 Proxy debug mode is ON");
});

module.exports = app;

  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${config.nodeEnv || "development"}`)
})

module.exports = app

