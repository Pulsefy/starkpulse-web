const express = require('express');
const router = express.Router();
const BlockchainAnalyticsEngine = require('../services/blockchain-analytics/engine');
const { auth } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');

// Initialize analytics engine
const analyticsEngine = new BlockchainAnalyticsEngine();

// Start engine when module loads
analyticsEngine.start().catch(console.error);

// Address analysis endpoint
router.get('/address/:address', auth, rateLimiter, async (req, res) => {
  try {
    const { address } = req.params;
    const options = {
      timeframe: req.query.timeframe || '30d',
      includeGraph: req.query.includeGraph === 'true',
      depth: parseInt(req.query.depth) || 2
    };

    const analysis = await analyticsEngine.analyzeAddress(address, options);
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Whale tracking endpoint
router.get('/whales/movements', auth, async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '24h';
    const minValue = req.query.minValue || 1000000;
    
    const movements = await analyticsEngine.marketIntelligence.getWhaleMovements({
      timeframe,
      minValue
    });
    
    res.json({
      success: true,
      data: movements
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DeFi opportunities endpoint
router.get('/defi/opportunities', auth, async (req, res) => {
  try {
    const { address } = req.query;
    const minApr = req.query.minApr || 5;
    const maxRisk = req.query.maxRisk || 0.7;
    
    const opportunities = await analyticsEngine.defiAnalyzer.identifyYieldOpportunities(address);
    
    const filtered = opportunities.filter(op => 
      op.apr >= minApr && op.riskScore <= maxRisk
    );
    
    res.json({
      success: true,
      data: filtered
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Market manipulation alerts
router.get('/alerts/manipulation', auth, async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '24h';
    const minConfidence = req.query.minConfidence || 0.7;
    
    const alerts = await analyticsEngine.marketIntelligence.getManipulationAlerts({
      timeframe,
      minConfidence
    });
    
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cross-chain bridge monitoring
router.get('/bridges/activity', auth, async (req, res) => {
  try {
    const activity = await analyticsEngine.marketIntelligence.getBridgeActivity();
    
    res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Protocol risk assessment
router.get('/protocols/risks', auth, async (req, res) => {
  try {
    const { address } = req.query;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Address parameter is required'
      });
    }
    
    const risks = await analyticsEngine.defiAnalyzer.assessProtocolRisks(address);
    
    res.json({
      success: true,
      data: risks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// MEV detection endpoint
router.get('/mev/detection/:address', auth, async (req, res) => {
  try {
    const { address } = req.params;
    const timeframe = req.query.timeframe || '7d';
    
    const mevActivity = await analyticsEngine.onChainAnalyzer.detectMEVActivity(address, timeframe);
    
    res.json({
      success: true,
      data: mevActivity
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;