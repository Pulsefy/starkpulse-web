import type { Request, Response } from "express"
import { PortfolioAnalyticsEngine } from "../services/portfolio-analytics"
import type { Portfolio, StressTestScenario } from "../types/portfolio"

export class AnalyticsController {
  private analyticsEngine: PortfolioAnalyticsEngine

  constructor() {
    this.analyticsEngine = new PortfolioAnalyticsEngine()
  }

  async getPortfolioAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { portfolioId } = req.params
      const { timeframe = "1Y" } = req.query

      // In a real app, fetch portfolio from database
      const portfolio = await this.getPortfolioById(portfolioId)

      if (!portfolio) {
        res.status(404).json({ error: "Portfolio not found" })
        return
      }

      const [performanceMetrics, riskMetrics, sectorAnalysis] = await Promise.all([
        this.analyticsEngine.calculatePerformanceMetrics(portfolio, timeframe as string),
        this.analyticsEngine.calculateRiskMetrics(portfolio, []), // Would pass actual returns
        this.analyticsEngine.analyzeSectorAllocation(portfolio),
      ])

      res.json({
        portfolio: {
          id: portfolio.id,
          name: portfolio.name,
          totalValue: portfolio.totalValue,
          totalCost: portfolio.totalCost,
          totalGainLoss: portfolio.totalGainLoss,
          totalGainLossPercent: portfolio.totalGainLossPercent,
        },
        performance: performanceMetrics,
        risk: riskMetrics,
        allocation: sectorAnalysis,
        lastUpdated: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Error calculating portfolio analytics:", error)
      res.status(500).json({ error: "Internal server error" })
    }
  }

  async getAssetAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { portfolioId, assetId } = req.params

      const portfolio = await this.getPortfolioById(portfolioId)
      if (!portfolio) {
        res.status(404).json({ error: "Portfolio not found" })
        return
      }

      const asset = portfolio.assets.find((a) => a.id === assetId)
      if (!asset) {
        res.status(404).json({ error: "Asset not found" })
        return
      }

      const assetAnalysis = this.analyticsEngine.analyzeAssetPerformance(asset, portfolio.transactions)

      res.json({
        asset: {
          id: asset.id,
          symbol: asset.symbol,
          name: asset.name,
          sector: asset.sector,
          category: asset.category,
        },
        analysis: assetAnalysis,
        lastUpdated: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Error calculating asset analytics:", error)
      res.status(500).json({ error: "Internal server error" })
    }
  }

  async getRebalancingRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const { portfolioId } = req.params
      const targetAllocations = req.body.targetAllocations || {}

      const portfolio = await this.getPortfolioById(portfolioId)
      if (!portfolio) {
        res.status(404).json({ error: "Portfolio not found" })
        return
      }

      const recommendations = this.analyticsEngine.generateRebalancingRecommendations(portfolio, targetAllocations)

      res.json({
        recommendations,
        totalRebalancingAmount: recommendations.reduce((sum, rec) => sum + rec.recommendedAmount, 0),
        highPriorityCount: recommendations.filter((r) => r.priority === "HIGH").length,
        lastUpdated: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Error generating rebalancing recommendations:", error)
      res.status(500).json({ error: "Internal server error" })
    }
  }

  async performStressTest(req: Request, res: Response): Promise<void> {
    try {
      const { portfolioId } = req.params
      const scenarios: StressTestScenario[] = req.body.scenarios || this.getDefaultStressTestScenarios()

      const portfolio = await this.getPortfolioById(portfolioId)
      if (!portfolio) {
        res.status(404).json({ error: "Portfolio not found" })
        return
      }

      const stressTestResults = this.analyticsEngine.performStressTest(portfolio, scenarios)

      res.json({
        results: stressTestResults,
        lastUpdated: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Error performing stress test:", error)
      res.status(500).json({ error: "Internal server error" })
    }
  }

  async getTaxLossHarvestingOpportunities(req: Request, res: Response): Promise<void> {
    try {
      const { portfolioId } = req.params

      const portfolio = await this.getPortfolioById(portfolioId)
      if (!portfolio) {
        res.status(404).json({ error: "Portfolio not found" })
        return
      }

      const opportunities = this.analyticsEngine.identifyTaxLossHarvestingOpportunities(
        portfolio,
        portfolio.transactions,
      )

      res.json({
        opportunities: opportunities.opportunities,
        summary: {
          totalOpportunities: opportunities.opportunities.length,
          totalPotentialLoss: opportunities.totalPotentialLoss,
          totalTaxSavings: opportunities.totalTaxSavings,
        },
        lastUpdated: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Error identifying tax-loss harvesting opportunities:", error)
      res.status(500).json({ error: "Internal server error" })
    }
  }

  async getDrawdownAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { portfolioId } = req.params
      const { timeframe = "1Y" } = req.query

      const portfolio = await this.getPortfolioById(portfolioId)
      if (!portfolio) {
        res.status(404).json({ error: "Portfolio not found" })
        return
      }

      // Get historical portfolio values
      const historicalValues = await this.getHistoricalPortfolioValues(portfolioId, timeframe as string)
      const drawdownAnalysis = this.analyticsEngine.calculateDrawdownAnalysis(historicalValues)

      res.json({
        analysis: drawdownAnalysis,
        timeframe,
        lastUpdated: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Error calculating drawdown analysis:", error)
      res.status(500).json({ error: "Internal server error" })
    }
  }

  // Helper methods
  private async getPortfolioById(portfolioId: string): Promise<Portfolio | null> {
    // Mock portfolio data - in a real app, this would query the database
    return {
      id: portfolioId,
      name: "Sample Portfolio",
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
        {
          id: "3",
          symbol: "MSFT",
          name: "Microsoft Corporation",
          sector: "Technology",
          category: "Large Cap Growth",
          currentPrice: 350.0,
          quantity: 500,
          averageCost: 300.0,
          marketValue: 175000,
          weight: 0.175,
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
  }

  private async getHistoricalPortfolioValues(portfolioId: string, timeframe: string): Promise<number[]> {
    // Mock historical data - in a real app, this would query historical portfolio values
    const days = timeframe === "1Y" ? 365 : timeframe === "6M" ? 180 : 90
    const values: number[] = []
    let value = 850000 // Starting value

    for (let i = 0; i < days; i++) {
      value *= 1 + (Math.random() - 0.5) * 0.02
      values.push(value)
    }

    return values
  }

  private getDefaultStressTestScenarios(): StressTestScenario[] {
    return [
      {
        name: "Market Crash",
        description: "2008-style market crash scenario",
        shocks: {
          AAPL: -40,
          GOOGL: -35,
          MSFT: -30,
        },
        expectedPortfolioImpact: -35,
      },
      {
        name: "Tech Sector Correction",
        description: "Technology sector specific downturn",
        shocks: {
          AAPL: -25,
          GOOGL: -30,
          MSFT: -20,
        },
        expectedPortfolioImpact: -25,
      },
      {
        name: "Interest Rate Shock",
        description: "Rapid interest rate increase",
        shocks: {
          AAPL: -15,
          GOOGL: -20,
          MSFT: -10,
        },
        expectedPortfolioImpact: -15,
      },
    ]
  }
}
