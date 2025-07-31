// Market Intelligence API Routes
const express = require('express');
const router = express.Router();

// Import services (to be implemented)
const aggregator = require('../services/market-data/aggregator');
const orderbook = require('../services/market-data/orderbook');
const arbitrage = require('../services/market-data/arbitrage');
const newsSentiment = require('../services/sentiment/news');
const socialSentiment = require('../services/sentiment/social');
const sentimentIndex = require('../services/sentiment/index');
const pricePrediction = require('../services/predictive/price');
const volatility = require('../services/predictive/volatility');
const correlation = require('../services/predictive/correlation');
const trend = require('../services/predictive/trend');

// Market data endpoint (real-time from Binance for now)
router.get('/market-data', async (req, res) => {
  try {
    const symbol = req.query.symbol || 'BTCUSDT';
    const data = await aggregator.fetchBinanceMarketData(symbol);
    res.json({ source: 'binance', symbol, data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch market data', details: error.message });
  }
});
router.get('/orderbook', (req, res) => res.json({ message: 'Order book endpoint coming soon.' }));
router.get('/arbitrage', (req, res) => res.json({ message: 'Arbitrage endpoint coming soon.' }));
router.get('/sentiment/news', async (req, res) => {
  try {
    const sentiment = await newsSentiment.getNewsSentiment();
    res.json({ source: 'cryptopanic', sentiment });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch or analyze news sentiment', details: error.message });
  }
});
router.get('/sentiment/social', async (req, res) => {
  try {
    const sentiment = await socialSentiment.getSocialSentiment();
    res.json({ source: 'mock', sentiment });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch social sentiment', details: error.message });
  }
});
router.get('/sentiment/index', async (req, res) => {
  try {
    const symbol = req.query.symbol || 'BTCUSDT';
    const index = await sentimentIndex.computeFearGreedIndex(symbol);
    res.json({ symbol, ...index });
  } catch (error) {
    res.status(500).json({ error: 'Failed to compute fear/greed index', details: error.message });
  }
});
router.get('/predictive/price', async (req, res) => {
  try {
    const symbol = req.query.symbol || 'BTCUSDT';
    const prediction = await pricePrediction.predictPrice(symbol);
    res.json({ symbol, prediction });
  } catch (error) {
    res.status(500).json({ error: 'Failed to predict price', details: error.message });
  }
});
router.get('/predictive/volatility', async (req, res) => {
  try {
    const symbol = req.query.symbol || 'BTCUSDT';
    const volatilityValue = await volatility.calculateVolatility(symbol);
    res.json({ symbol, volatility: volatilityValue });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate volatility', details: error.message });
  }
});
router.get('/predictive/correlation', async (req, res) => {
  try {
    const symbol1 = req.query.symbol1 || 'BTCUSDT';
    const symbol2 = req.query.symbol2 || 'ETHUSDT';
    const correlation = await correlationService.getCorrelation(symbol1, symbol2);
    res.json({ symbol1, symbol2, correlation });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate correlation', details: error.message });
  }
});
router.get('/predictive/trend', async (req, res) => {
  try {
    const symbol = req.query.symbol || 'BTCUSDT';
    const trendValue = await trend.identifyTrend(symbol);
    res.json({ symbol, trend: trendValue });
  } catch (error) {
    res.status(500).json({ error: 'Failed to identify trend', details: error.message });
  }
});

module.exports = router;
