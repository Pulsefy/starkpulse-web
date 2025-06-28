const analyticsService = require('../services/analytics.service');

exports.getUserAnalytics = async (req, res) => {
  const data = await analyticsService.getUserAnalytics();
  res.json(data);
};

exports.getPortfolioAnalytics = async (req, res) => {
  const data = await analyticsService.getPortfolioPerformance();
  res.json(data);
};

exports.getPlatformMetrics = async (req, res) => {
  const data = await analyticsService.getPlatformStats();
  res.json(data);
};

exports.exportData = async (req, res) => {
  const { format = 'json' } = req.query;
  const data = await analyticsService.getUserAnalytics(); // example

  if (format === 'csv') {
    const { toCSV } = require('../utils/exporter');
    res.header('Content-Type', 'text/csv');
    res.attachment('analytics.csv');
    return res.send(toCSV(data));
  }

  res.json(data);
};