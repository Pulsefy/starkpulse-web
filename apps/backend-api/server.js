const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const { limiter, authLimiter } = require("./src/middleware/rateLimiter");
require("dotenv").config();

const { errorHandler } = require("./src/middleware/errorHandler");
const authRoutes = require("./src/routes/auth");
const userRoutes = require("./src/routes/users");
const http = require("http");
const alertRoutes = require("./routes/alerts");
const MonitoringService = require("./services/MonitoringService");
const { setupWebSocket } = require("./utils/websocket");
const alertLimiter = require("./middleware/alertLimiter");

// ==========================
// App Initialization
// ==========================
const app = express();

const server = http.createServer(app);
setupWebSocket(server);

const PORT = process.env.PORT || 3000;

// ==========================
// Global Middleware
// ==========================
app.use(helmet());
app.use(compression());

// ==========================
// Rate Limiting
// ==========================
app.use(limiter);

// ==========================
// CORS Configuration
// ==========================
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ==========================
// Body Parsing Middleware
// ==========================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ==========================
// HTTP Logging
// ==========================
app.use(morgan("combined"));

// ==========================
// MongoDB Connection
// ==========================
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ==========================
// API Routes
// ==========================
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/user", userRoutes);

// Routes
app.use("/api/alerts", alertLimiter, alertRoutes);

// Start monitoring service
MonitoringService.start();

// Graceful shutdown
process.on("SIGTERM", () => {
  MonitoringService.stop();
  process.exit(0);
});

// ==========================
// Health Check Endpoint
// ==========================
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ==========================
// Error Handlers
// ==========================
app.use(errorHandler);
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ==========================
// Graceful Shutdown
// ==========================
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  mongoose.connection.close(() => {
    console.log("MongoDB connection closed");
    process.exit(0);
  });
});

// ==========================
// Server Start
// ==========================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;
