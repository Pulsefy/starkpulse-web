const express = require('express');
const router = express.Router();
const portfolioController = require('../controllers/portfolio.controller');
const { authenticate } = require('../middleware/auth');

// Get portfolio
router.get('/', authenticate, async (req, res, next) => {
  try {
    const portfolio = await portfolioController.getPortfolio(req.user._id);
    res.json(portfolio);
  } catch (error) {
    next(error);
  }
});

// Add asset
router.post('/assets', authenticate, async (req, res, next) => {
  try {
    const portfolio = await portfolioController.addAsset(req.user._id, req.body);
    res.status(201).json(portfolio);
  } catch (error) {
    next(error);
  }
});

// Update asset
router.put('/assets/:assetId', authenticate, async (req, res, next) => {
  try {
    const portfolio = await portfolioController.updateAsset(
      req.user._id,
      req.params.assetId,
      req.body
    );
    res.json(portfolio);
  } catch (error) {
    next(error);
  }
});

// Remove asset
router.delete('/assets/:assetId', authenticate, async (req, res, next) => {
  try {
    const portfolio = await portfolioController.removeAsset(
      req.user._id,
      req.params.assetId
    );
    res.json(portfolio);
  } catch (error) {
    next(error);
  }
});

// Get portfolio metrics
router.get('/metrics', authenticate, async (req, res, next) => {
  try {
    const metrics = await portfolioController.getPortfolioMetrics(req.user._id);
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

// Get portfolio history
router.get('/history', authenticate, async (req, res, next) => {
  try {
    const history = await portfolioController.getPortfolioHistory(
      req.user._id,
      req.query.timeframe
    );
    res.json(history);
  } catch (error) {
    next(error);
  }
});

module.exports = router;