const db = require('../../db');

async function getUserAnalytics() {
  return db.analytics.aggregate([
    { $match: { userId: { $ne: null } } },
    { $group: { _id: "$userId", totalActions: { $sum: 1 } } },
  ]);
}

async function getPortfolioPerformance() {
  return db.portfolios.aggregate([
    { $group: { _id: "$userId", avgReturn: { $avg: "$performance.return" } } }
  ]);
}

async function getPlatformStats() {
  const totalRequests = await db.analytics.countDocuments();
  const activeUsers = await db.analytics.distinct("userId");

  return {
    totalRequests,
    activeUsers: activeUsers.length,
  };
}

module.exports = {
  getUserAnalytics,
  getPortfolioPerformance,
  getPlatformStats,
};