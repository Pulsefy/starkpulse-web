const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Import middleware
const { security, cors, rateLimiter, errorHandler } = require('./src/middleware');

// Apply security middleware
app.use(security);

// Apply CORS
app.use(cors);

// Apply general rate limiting globally
app.use(rateLimiter.generalLimiter);

// Parse JSON and urlencoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Example: Apply stricter rate limiting to auth routes
app.use('/auth', rateLimiter.authLimiter);

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to your Express.js API!" });
});

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Error handler (should be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`)
})

module.exports = app
