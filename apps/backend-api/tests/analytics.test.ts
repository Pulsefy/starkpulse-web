import { PortfolioAnalyticsEngine } from "../services/portfolio-analytics"
import type { Portfolio, Asset } from "../types/portfolio"

describe("Portfolio Analytics Engine", () => {
  let analyticsEngine: PortfolioAnalyticsEngine
  let mockPortfolio: Portfolio

  beforeEach(() => {
    analyticsEngine = new PortfolioAnalyticsEngine()

    mockPortfolio = {
      id: "test-portfolio",
      name: "Test Portfolio",
      totalValue: 1000000,
      totalCost: 850000,
      totalGainLoss: 150000,
      totalGainLossPercent: 17.65,
      benchmarkSymbol: "SPY",
      assets: [
        {
          id: "1",
          symbol: "AAPL",
          name: "Apple Inc.",
          sector: "Technology",
          category: "Large Cap Growth",
          currentPrice: 175.5,
          quantity: 1000,
          averageCost: 150.0,
          marketValue: 175500,
          weight: 0.1755,
          lastUpdated: new Date(),
        },
        {
          id: "2",
          symbol: "GOOGL",
          name: "Alphabet Inc.",
          sector: "Technology",
          category: "Large Cap Growth",
          currentPrice: 2800.0,
          quantity: 100,
          averageCost: 2500.0,
          marketValue: 280000,
          weight: 0.28,
          lastUpdated: new Date(),
        },
      ],
      transactions: [
        {
          id: "1",
          assetId: "1",
          type: "BUY",
          quantity: 1000,
          price: 150.0,
          amount: 150000,
          fees: 10,
          timestamp: new Date("2023-01-15"),
          taxLot: "lot1",
        },
      ],
      createdAt: new Date("2023-01-01"),
      updatedAt: new Date(),
    }
  })

  describe("Performance Calculations", () => {
    test("should calculate ROI correctly", async () => {
      const metrics = await analyticsEngine.calculatePerformanceMetrics(mockPortfolio)
      expect(metrics.roi).toBeCloseTo(17.65, 2)
    })

    test("should calculate Sharpe ratio", async () => {
      const metrics = await analyticsEngine.calculatePerformanceMetrics(mockPortfolio)
      expect(metrics.sharpeRatio).toBeDefined()
      expect(typeof metrics.sharpeRatio).toBe("number")
    })

    test("should calculate alpha and beta", async () => {
      const metrics = await analyticsEngine.calculatePerformanceMetrics(mockPortfolio)
      expect(metrics.alpha).toBeDefined()
      expect(metrics.beta).toBeDefined()
      expect(typeof metrics.alpha).toBe("number")
      expect(typeof metrics.beta).toBe("number")
    })

    test("should calculate volatility", async () => {
      const metrics = await analyticsEngine.calculatePerformanceMetrics(mockPortfolio)
      expect(metrics.volatility).toBeDefined()
      expect(metrics.volatility).toBeGreaterThan(0)
    })
  })

  describe("Risk Assessment", () => {
    test("should calculate VaR at different confidence levels", async () => {
      const returns = [0.01, -0.02, 0.03, -0.01, 0.02, -0.03, 0.01]
      const riskMetrics = analyticsEngine.calculateRiskMetrics(mockPortfolio, returns)

      expect(riskMetrics.valueAtRisk.var95).toBeDefined()
      expect(riskMetrics.valueAtRisk.var99).toBeDefined()
      expect(riskMetrics.valueAtRisk.var99).toBeLessThan(riskMetrics.valueAtRisk.var95)
    })

    test("should calculate concentration risk", async () => {
      const returns = [0.01, -0.02, 0.03, -0.01, 0.02]
      const riskMetrics = analyticsEngine.calculateRiskMetrics(mockPortfolio, returns)

      expect(riskMetrics.concentrationRisk.herfindahlIndex).toBeDefined()
      expect(riskMetrics.concentrationRisk.topHoldings).toHaveLength(2)
    })

    test("should calculate diversification ratio", async () => {
      const returns = [0.01, -0.02, 0.03, -0.01, 0.02]
      const riskMetrics = analyticsEngine.calculateRiskMetrics(mockPortfolio, returns)

      expect(riskMetrics.diversificationRatio).toBeDefined()
      expect(riskMetrics.diversificationRatio).toBeGreaterThan(0)
    })
  })

  describe("Asset Analysis", () => {
    test("should analyze individual asset performance", () => {
      const asset = mockPortfolio.assets[0]
      const analysis = analyticsEngine.analyzeAssetPerformance(asset, mockPortfolio.transactions)

      expect(analysis.totalReturn).toBeCloseTo(17, 0)
      expect(analysis.unrealizedGainLoss).toBeCloseTo(25500, 0)
      expect(analysis.holdingPeriod).toBeGreaterThan(0)
    })

    test("should calculate sector allocation", () => {
      const sectorAnalysis = analyticsEngine.analyzeSectorAllocation(mockPortfolio)

      expect(sectorAnalysis.sectorAllocation).toBeDefined()
      expect(sectorAnalysis.sectorAllocation.Technology).toBeCloseTo(100, 0)
      expect(sectorAnalysis.diversificationScore).toBeDefined()
    })
  })

  describe("Rebalancing Recommendations", () => {
    test("should generate rebalancing recommendations", () => {
      const targetAllocations = {
        AAPL: 0.3,
        GOOGL: 0.3,
        MSFT: 0.4,
      }

      const recommendations = analyticsEngine.generateRebalancingRecommendations(mockPortfolio, targetAllocations)

      expect(recommendations).toBeInstanceOf(Array)
      expect(recommendations.length).toBeGreaterThan(0)
      expect(recommendations[0]).toHaveProperty("recommendedAction")
      expect(recommendations[0]).toHaveProperty("priority")
    })
  })

  describe("Drawdown Analysis", () => {
    test("should calculate drawdown metrics", () => {
      const historicalValues = [100, 105, 98, 102, 95, 110, 108, 115]
      const drawdownAnalysis = analyticsEngine.calculateDrawdownAnalysis(historicalValues)

      expect(drawdownAnalysis.maxDrawdown).toBeDefined()
      expect(drawdownAnalysis.averageDrawdown).toBeDefined()
      expect(drawdownAnalysis.maxDrawdown).toBeGreaterThan(0)
    })
  })

  describe("Tax-Loss Harvesting", () => {
    test("should identify tax-loss harvesting opportunities", () => {
      // Create a losing position
      const losingAsset: Asset = {
        ...mockPortfolio.assets[0],
        currentPrice: 120.0, // Below average cost of 150
        marketValue: 120000,
      }

      const portfolioWithLoss = {
        ...mockPortfolio,
        assets: [losingAsset],
      }

      const opportunities = analyticsEngine.identifyTaxLossHarvestingOpportunities(
        portfolioWithLoss,
        mockPortfolio.transactions,
      )

      expect(opportunities.opportunities).toBeInstanceOf(Array)
      expect(opportunities.totalPotentialLoss).toBeLessThan(0)
      expect(opportunities.totalTaxSavings).toBeLessThan(0)
    })
  })

  describe("Performance Requirements", () => {
    test("should handle large portfolios efficiently", async () => {
      // Create a large portfolio
      const largeAssets: Asset[] = []
      for (let i = 0; i < 1000; i++) {
        largeAssets.push({
          id: `asset-${i}`,
          symbol: `STOCK${i}`,
          name: `Stock ${i}`,
          sector: "Technology",
          category: "Large Cap",
          currentPrice: 100 + Math.random() * 50,
          quantity: 100,
          averageCost: 100,
          marketValue: 10000 + Math.random() * 5000,
          weight: 0.001,
          lastUpdated: new Date(),
        })
      }

      const largePortfolio = {
        ...mockPortfolio,
        assets: largeAssets,
        totalValue: 12500000,
      }

      const startTime = Date.now()
      const metrics = await analyticsEngine.calculatePerformanceMetrics(largePortfolio)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
      expect(metrics).toBeDefined()
    })
  })
})
