const analyticsService = require("../services/analytics.service");
const { toCSV } = require("../utils/exporter");

exports.getUserAnalytics = async (req, res) => {
  try {
    const data = await analyticsService.getUserAnalytics();
    res.status(200).json(data);
  } catch (err) {
    console.error("Error fetching user analytics:", err);
    res.status(500).json({ error: "Failed to fetch user analytics" });
  }
};

exports.getPortfolioAnalytics = async (req, res) => {
  try {
    const data = await analyticsService.getPortfolioPerformance();
    res.status(200).json(data);
  } catch (err) {
    console.error("Error fetching portfolio analytics:", err);
    res.status(500).json({ error: "Failed to fetch portfolio performance" });
  }
};

exports.getPlatformMetrics = async (req, res) => {
  try {
    const data = await analyticsService.getPlatformStats();
    res.status(200).json(data);
  } catch (err) {
    console.error("Error fetching platform metrics:", err);
    res.status(500).json({ error: "Failed to fetch platform metrics" });
  }
};

exports.exportData = async (req, res) => {
  const { format = "json", type = "user" } = req.query;

  try {
    let data;

    if (type === "portfolio") {
      data = await analyticsService.getPortfolioPerformance();
    } else if (type === "platform") {
      data = await analyticsService.getPlatformStats();
    } else {
      data = await analyticsService.getUserAnalytics();
    }

    if (format === "csv") {
      res.header("Content-Type", "text/csv");
      res.attachment(`${type}_analytics.csv`);
      return res.send(toCSV(data));
    }

    res.status(200).json(data);
  } catch (err) {
    console.error("Error exporting analytics data:", err);
    res.status(500).json({ error: "Failed to export analytics data" });
  }
};
