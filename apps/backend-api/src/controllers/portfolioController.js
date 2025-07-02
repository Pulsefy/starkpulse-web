const Portfolio = require('../models/portfolio.model');
const { calculatePortfolioMetrics } = require('../services/portfolioCalculations.js');

exports.createPortfolio = async (userId) => {
  try {
    const portfolio = new Portfolio({ userId, assets: [] });
    await portfolio.save();
    return portfolio;
  } catch (error) {
    throw error;
  }
};

exports.getPortfolio = async (userId) => {
  try {
    const portfolio = await Portfolio.findOne({ userId }).populate('userId', 'email username');
    if (!portfolio) {
      return await this.createPortfolio(userId);
    }
    return portfolio;
  } catch (error) {
    throw error;
  }
};

exports.addAsset = async (userId, assetData) => {
  try {
    const portfolio = await Portfolio.findOneAndUpdate(
      { userId },
      { $push: { assets: assetData } },
      { new: true, upsert: true }
    );
    return portfolio;
  } catch (error) {
    throw error;
  }
};

exports.updateAsset = async (userId, assetId, updateData) => {
  try {
    const portfolio = await Portfolio.findOne({ userId });
    if (!portfolio) throw new Error('Portfolio not found');

    const asset = portfolio.assets.id(assetId);
    if (!asset) throw new Error('Asset not found');

    Object.assign(asset, updateData);
    await portfolio.save();
    return portfolio;
  } catch (error) {
    throw error;
  }
};

exports.removeAsset = async (userId, assetId) => {
  try {
    const portfolio = await Portfolio.findOneAndUpdate(
      { userId },
      { $pull: { assets: { _id: assetId } } },
      { new: true }
    );
    return portfolio;
  } catch (error) {
    throw error;
  }
};

exports.getPortfolioMetrics = async (userId) => {
  try {
    const portfolio = await this.getPortfolio(userId);
    const metrics = await calculatePortfolioMetrics(portfolio);
    return metrics;
  } catch (error) {
    throw error;
  }
};

exports.getPortfolioHistory = async (userId, timeframe = '30d') => {
  try {
    const portfolio = await this.getPortfolio(userId);
    return {
      portfolioId: portfolio._id,
      userId: portfolio.userId,
      history: [], // Placeholder for actual historical data
      timeframe
    };
  } catch (error) {
    throw error;
  }
};