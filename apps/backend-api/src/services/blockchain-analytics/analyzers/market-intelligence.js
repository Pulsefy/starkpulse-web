const { EventEmitter } = require('events');
const logger = require('../../../utils/logger');

class MarketIntelligence extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.whaleAddresses = new Set();
    this.institutionalAddresses = new Set();
    this.monitoredBridges = new Map();
  }

  async start() {
    await this.loadWhaleAddresses();
    await this.loadInstitutionalAddresses();
    await this.setupBridgeMonitoring();
    
    // Start monitoring loops
    this.startWhaleMonitoring();
    this.startManipulationDetection();
    this.startBridgeMonitoring();
    
    logger.info('Market Intelligence started');
  }

  async stop() {
    if (this.whaleMonitorInterval) clearInterval(this.whaleMonitorInterval);
    if (this.manipulationInterval) clearInterval(this.manipulationInterval);
    if (this.bridgeMonitorInterval) clearInterval(this.bridgeMonitorInterval);
    
    logger.info('Market Intelligence stopped');
  }

  startWhaleMonitoring() {
    this.whaleMonitorInterval = setInterval(async () => {
      try {
        await this.monitorWhaleMovements();
      } catch (error) {
        logger.error('Error in whale monitoring:', error);
      }
    }, 60000); // Every minute
  }

  startManipulationDetection() {
    this.manipulationInterval = setInterval(async () => {
      try {
        await this.detectMarketManipulation();
      } catch (error) {
        logger.error('Error in manipulation detection:', error);
      }
    }, 300000); // Every 5 minutes
  }

  startBridgeMonitoring() {
    this.bridgeMonitorInterval = setInterval(async () => {
      try {
        await this.monitorCrossChainBridges();
      } catch (error) {
        logger.error('Error in bridge monitoring:', error);
      }
    }, 120000); // Every 2 minutes
  }

  async monitorWhaleMovements() {
    const recentTransactions = await this.getRecentLargeTransactions();
    
    for (const tx of recentTransactions) {
      if (tx.value > this.config.alertThresholds.whaleMovement) {
        const movement = {
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          timestamp: tx.timestamp,
          isWhaleAddress: this.whaleAddresses.has(tx.from) || this.whaleAddresses.has(tx.to),
          isInstitutional: this.institutionalAddresses.has(tx.from) || this.institutionalAddresses.has(tx.to),
          marketImpact: await this.estimateMarketImpact(tx)
        };

        this.emit('whale-movement', movement);
        
        // Store for analysis
        await this.storeWhaleMovement(movement);
      }
    }
  }

  async detectMarketManipulation() {
    const suspiciousPatterns = await this.analyzeSuspiciousPatterns();
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.confidence > 0.7) {
        this.emit('manipulation-detected', pattern);
        await this.storeManipulationAlert(pattern);
      }
    }
  }

  async monitorCrossChainBridges() {
    for (const [bridgeName, bridgeData] of this.monitoredBridges) {
      const activity = await this.getBridgeActivity(bridgeData.address);
      
      // Detect unusual bridge activity
      if (activity.volume24h > bridgeData.avgVolume * 3) {
        this.emit('bridge-alert', {
          bridge: bridgeName,
          type: 'high_volume',
          volume: activity.volume24h,
          avgVolume: bridgeData.avgVolume,
          timestamp: new Date().toISOString()
        });
      }
      
      // Update average volume
      bridgeData.avgVolume = (bridgeData.avgVolume * 0.9) + (activity.volume24h * 0.1);
    }
  }

  async analyzeInstitutionalFlow(address, timeframe = '7d') {
    try {
      const transactions = await this.getTransactionHistory(address, timeframe);
      
      const institutionalPatterns = {
        regularDeposits: this.detectRegularDeposits(transactions),
        batchTransactions: this.detectBatchTransactions(transactions),
        custodyPatterns: this.detectCustodyPatterns(transactions),
        otcActivity: this.detectOTCActivity(transactions)
      };

      const flowAnalysis = {
        totalInflow: 0,
        totalOutflow: 0,
        netFlow: 0,
        avgTransactionSize: 0,
        institutionalScore: 0
      };

      // Calculate flows
      for (const tx of transactions) {
        if (tx.to?.toLowerCase() === address.toLowerCase()) {
          flowAnalysis.totalInflow += tx.value;
        } else {
          flowAnalysis.totalOutflow += tx.value;
        }
      }

      flowAnalysis.netFlow = flowAnalysis.totalInflow - flowAnalysis.totalOutflow;
      flowAnalysis.avgTransactionSize = (flowAnalysis.totalInflow + flowAnalysis.totalOutflow) / transactions.length;
      flowAnalysis.institutionalScore = this.calculateInstitutionalScore(institutionalPatterns, flowAnalysis);

      return {
        address,
        timeframe,
        patterns: institutionalPatterns,
        flow: flowAnalysis,
        isInstitutional: flowAnalysis.institutionalScore > 0.6
      };
    } catch (error) {
      logger.error('Error analyzing institutional flow:', error);
      return { error: error.message };
    }
  }

  async analyzeSuspiciousPatterns() {
    const patterns = [];
    
    // Wash trading detection
    const washTradingPatterns = await this.detectWashTrading();
    patterns.push(...washTradingPatterns);
    
    // Pump and dump detection
    const pumpDumpPatterns = await this.detectPumpAndDump();
    patterns.push(...pumpDumpPatterns);
    
    // Coordinated trading detection
    const coordinatedPatterns = await this.detectCoordinatedTrading();
    patterns.push(...coordinatedPatterns);
    
    return patterns;
  }

  async detectWashTrading() {
    // Implementation for wash trading detection
    const recentTrades = await this.getRecentTrades();
    const suspiciousPatterns = [];
    
    // Group trades by token pairs
    const tradeGroups = this.groupTradesByPair(recentTrades);
    
    for (const [pair, trades] of tradeGroups) {
      const backAndForthTrades = this.findBackAndForthTrades(trades);
      
      if (backAndForthTrades.length > 5) {
        suspiciousPatterns.push({
          type: 'wash_trading',
          pair,
          trades: backAndForthTrades,
          confidence: this.calculateWashTradingConfidence(backAndForthTrades),
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return suspiciousPatterns;
  }

  async detectPumpAndDump() {
    const patterns = [];
    const tokens = await this.getTokensWithHighVolatility();
    
    for (const token of tokens) {
      const priceHistory = await this.getTokenPriceHistory(token.address, '24h');
      const volumeHistory = await this.getTokenVolumeHistory(token.address, '24h');
      
      const pumpSignals = this.analyzePumpSignals(priceHistory, volumeHistory);
      
      if (pumpSignals.confidence > 0.6) {
        patterns.push({
          type: 'pump_and_dump',
          token: token.address,
          symbol: token.symbol,
          signals: pumpSignals,
          confidence: pumpSignals.confidence,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return patterns;
  }

  // Helper methods
  async loadWhaleAddresses() {
    // Load known whale addresses from database or external source
    const whales = [
      '0x...',  // Example whale addresses
      '0x...'
    ];
    
    whales.forEach(address => this.whaleAddresses.add(address.toLowerCase()));
  }

  async loadInstitutionalAddresses() {
    // Load known institutional addresses
    const institutions = [
      '0x...',  // Example institutional addresses
      '0x...'
    ];
    
    institutions.forEach(address => this.institutionalAddresses.add(address.toLowerCase()));
  }

  async setupBridgeMonitoring() {
    // Setup monitoring for major cross-chain bridges
    this.monitoredBridges.set('polygon', {
      address: '0x...',
      avgVolume: 1000000
    });
    
    this.monitoredBridges.set('arbitrum', {
      address: '0x...',
      avgVolume: 2000000
    });
  }

  calculateInstitutionalScore(patterns, flowAnalysis) {
    let score = 0;
    
    if (patterns.regularDeposits) score += 0.2;
    if (patterns.batchTransactions) score += 0.3;
    if (patterns.custodyPatterns) score += 0.3;
    if (patterns.otcActivity) score += 0.2;
    
    // Large average transaction size indicates institutional activity
    if (flowAnalysis.avgTransactionSize > 100000) score += 0.2;
    
    return Math.min(score, 1.0);
  }
}

module.exports = MarketIntelligence;