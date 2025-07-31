const BlockchainAnalyticsEngine = require('../../src/services/blockchain-analytics/engine');
const OnChainAnalyzer = require('../../src/services/blockchain-analytics/analyzers/onchain-analyzer');
const DeFiAnalyzer = require('../../src/services/blockchain-analytics/analyzers/defi-analyzer');
const MarketIntelligence = require('../../src/services/blockchain-analytics/analyzers/market-intelligence');

describe('Blockchain Analytics Engine', () => {
  let engine;
  
  beforeEach(() => {
    engine = new BlockchainAnalyticsEngine({
      batchSize: 100,
      cacheTimeout: 60
    });
  });

  afterEach(async () => {
    await engine.stop();
  });

  describe('Engine Initialization', () => {
    test('should initialize with default config', () => {
      expect(engine.config.batchSize).toBe(100);
      expect(engine.onChainAnalyzer).toBeInstanceOf(OnChainAnalyzer);
      expect(engine.defiAnalyzer).toBeInstanceOf(DeFiAnalyzer);
      expect(engine.marketIntelligence).toBeInstanceOf(MarketIntelligence);
    });

    test('should start and stop properly', async () => {
      await engine.start();
      expect(engine.isRunning).toBe(true);
      
      await engine.stop();
      expect(engine.isRunning).toBe(false);
    });
  });

  describe('Address Analysis', () => {
    test('should analyze address comprehensively', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      
      // Mock the analyzer methods
      jest.spyOn(engine.onChainAnalyzer, 'analyzeAddress').mockResolvedValue({
        transactionFlow: { totalVolume: 1000 },
        isWhale: true,
        suspiciousPatterns: []
      });
      
      jest.spyOn(engine.defiAnalyzer, 'analyzeAddress').mockResolvedValue({
        liquidityAnalysis: { totalLiquidity: 500000 },
        yieldOpportunities: []
      });
      
      jest.spyOn(engine.graphAnalyzer, 'analyzeAddress').mockResolvedValue({
        centrality: { degree: { totalDegree: 50 } }
      });

      const result = await engine.analyzeAddress(mockAddress);
      
      expect(result).toHaveProperty('address', mockAddress);
      expect(result).toHaveProperty('onChain');
      expect(result).toHaveProperty('defi');
      expect(result).toHaveProperty('graph');
      expect(result).toHaveProperty('riskScore');
      expect(result).toHaveProperty('insights');
    });

    test('should calculate risk score correctly', () => {
      const onChainData = {
        suspiciousPatterns: ['rapid_small_transactions'],
        mixerInteractions: 1
      };
      
      const defiData = {
        protocolRisks: { high: 1 },
        liquidityRisk: 0.8
      };
      
      const riskScore = engine.calculateRiskScore(onChainData, defiData);
      expect(riskScore).toBeGreaterThan(0);
      expect(riskScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Event Handling', () => {
    test('should emit alerts for whale movements', (done) => {
      engine.on('alert', (alert) => {
        expect(alert.type).toBe('whale-movement');
        expect(alert.data).toBeDefined();
        done();
      });
      
      // Simulate whale movement
      engine.onChainAnalyzer.emit('whale-movement', {
        address: '0x123',
        value: 2000000
      });
    });

    test('should emit alerts for yield opportunities', (done) => {
      engine.on('alert', (alert) => {
        expect(alert.type).toBe('yield-opportunity');
        done();
      });
      
      engine.defiAnalyzer.emit('yield-opportunity', {
        opportunities: [{ apr: 25, protocol: 'TestProtocol' }]
      });
    });
  });
});

describe('OnChain Analyzer', () => {
  let analyzer;
  
  beforeEach(() => {
    analyzer = new OnChainAnalyzer({});
  });

  test('should detect whale status correctly', () => {
    const whaleFlow = { totalVolume: 2000 };
    const normalFlow = { totalVolume: 100 };
    
    expect(analyzer.determineWhaleStatus(whaleFlow)).toBe(true);
    expect(analyzer.determineWhaleStatus(normalFlow)).toBe(false);
  });

  test('should detect suspicious patterns', () => {
    const suspiciousFlow = {
      transactionCount: 150,
      avgTransactionSize: 0.05,
      outflows: Array(100).fill({ value: 10 })
    };
    
    const patterns = analyzer.detectSuspiciousPatterns(suspiciousFlow);
    expect(patterns).toContain('rapid_small_transactions');
  });
});

describe('DeFi Analyzer', () => {
  let analyzer;
  
  beforeEach(() => {
    analyzer = new DeFiAnalyzer({});
  });

  test('should calculate liquidity risk correctly', () => {
    const liquidityAnalysis = {
      totalLiquidity: 1000000,
      pools: [
        {
          userLiquidity: 500000,
          impermanentLoss: 0.1,
          poolTotalLiquidity: 10000000,
          protocol: 'Uniswap'
        },
        {
          userLiquidity: 500000,
          impermanentLoss: 0.05,
          poolTotalLiquidity: 5000000,
          protocol: 'Curve'
        }
      ]
    };
    
    const risk = analyzer.calculateLiquidityRisk(liquidityAnalysis);
    expect(risk).toBeGreaterThan(0);
    expect(risk).toBeLessThan(1);
  });

  test('should calculate DeFi score correctly', () => {
    const liquidityAnalysis = {
      totalLiquidity: 500000,
      diversification: 0.8
    };
    
    const yieldOpportunities = [
      { apr: 15, protocol: 'Aave' },
      { apr: 20, protocol: 'Compound' }
    ];
    
    const score = analyzer.calculateDefiScore(liquidityAnalysis, yieldOpportunities);
    expect(score).toBeGreaterThan(0);
  });
});

describe('Market Intelligence', () => {
  let intelligence;
  
  beforeEach(() => {
    intelligence = new MarketIntelligence({
      alertThresholds: {
        whaleMovement: 1000000
      }
    });
  });

  test('should calculate institutional score correctly', () => {
    const patterns = {
      regularDeposits: true,
      batchTransactions: true,
      custodyPatterns: false,
      otcActivity: true
    };
    
    const flowAnalysis = {
      avgTransactionSize: 200000
    };
    
    const score = intelligence.calculateInstitutionalScore(patterns, flowAnalysis);
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThanOrEqual(1);
  });
});