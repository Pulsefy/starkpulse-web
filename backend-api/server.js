const express = require("express");
const marketRoutes = require("./routes/market");
const newsRoutes = require("./routes/news");
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/market", marketRoutes);
app.use("/news", newsRoutes);

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to your Express.js API!" });
});

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
