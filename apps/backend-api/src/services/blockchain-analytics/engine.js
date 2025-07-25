const { EventEmitter } = require('events');
const logger = require('../../utils/logger');
const { redisClient } = require('../../config/redis');
const OnChainAnalyzer = require('./analyzers/onchain-analyzer');
const DeFiAnalyzer = require('./analyzers/defi-analyzer');
const MarketIntelligence = require('./analyzers/market-intelligence');
const GraphAnalyzer = require('./analyzers/graph-analyzer');

class BlockchainAnalyticsEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      batchSize: 1000,
      cacheTimeout: 300, // 5 minutes
      alertThresholds: {
        whaleMovement: 1000000, // $1M USD
        liquidityChange: 0.1, // 10%
        gasSpike: 2.0 // 2x normal
      },
      ...config
    };

    this.onChainAnalyzer = new OnChainAnalyzer(this.config);
    this.defiAnalyzer = new DeFiAnalyzer(this.config);
    this.marketIntelligence = new MarketIntelligence(this.config);
    this.graphAnalyzer = new GraphAnalyzer(this.config);
    
    this.isRunning = false;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.onChainAnalyzer.on('whale-movement', (data) => {
      this.emit('alert', { type: 'whale-movement', data });
    });

    this.defiAnalyzer.on('yield-opportunity', (data) => {
      this.emit('alert', { type: 'yield-opportunity', data });
    });

    this.marketIntelligence.on('manipulation-detected', (data) => {
      this.emit('alert', { type: 'manipulation-detected', data });
    });
  }

  async start() {
    if (this.isRunning) return;
    
    logger.info('Starting Blockchain Analytics Engine');
    this.isRunning = true;

    // Start all analyzers
    await Promise.all([
      this.onChainAnalyzer.start(),
      this.defiAnalyzer.start(),
      this.marketIntelligence.start()
    ]);

    this.emit('started');
  }

  async stop() {
    if (!this.isRunning) return;
    
    logger.info('Stopping Blockchain Analytics Engine');
    this.isRunning = false;

    await Promise.all([
      this.onChainAnalyzer.stop(),
      this.defiAnalyzer.stop(),
      this.marketIntelligence.stop()
    ]);

    this.emit('stopped');
  }

  // Comprehensive analysis endpoint
  async analyzeAddress(address, options = {}) {
    const cacheKey = `address_analysis:${address}:${JSON.stringify(options)}`;
    
    try {
      // Check cache first
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const [onChainData, defiData, graphData] = await Promise.all([
        this.onChainAnalyzer.analyzeAddress(address, options),
        this.defiAnalyzer.analyzeAddress(address, options),
        this.graphAnalyzer.analyzeAddress(address, options)
      ]);

      const result = {
        address,
        timestamp: new Date().toISOString(),
        onChain: onChainData,
        defi: defiData,
        graph: graphData,
        riskScore: this.calculateRiskScore(onChainData, defiData),
        insights: this.generateInsights(onChainData, defiData, graphData)
      };

      // Cache result
      await redisClient.setex(cacheKey, this.config.cacheTimeout, JSON.stringify(result));
      
      return result;
    } catch (error) {
      logger.error('Error analyzing address:', error);
      throw error;
    }
  }

  calculateRiskScore(onChainData, defiData) {
    let score = 0;
    
    // Transaction patterns
    if (onChainData.suspiciousPatterns?.length > 0) score += 30;
    if (onChainData.mixerInteractions > 0) score += 40;
    
    // DeFi risks
    if (defiData.protocolRisks?.high > 0) score += 25;
    if (defiData.liquidityRisk > 0.7) score += 20;
    
    return Math.min(score, 100);
  }

  generateInsights(onChainData, defiData, graphData) {
    const insights = [];
    
    if (onChainData.isWhale) {
      insights.push({
        type: 'whale',
        message: 'Address shows whale-like behavior patterns',
        confidence: 0.9
      });
    }
    
    if (defiData.yieldOpportunities?.length > 0) {
      insights.push({
        type: 'yield',
        message: `${defiData.yieldOpportunities.length} yield opportunities identified`,
        confidence: 0.8
      });
    }
    
    return insights;
  }
}

module.exports = BlockchainAnalyticsEngine;