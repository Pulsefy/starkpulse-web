import type {
  Asset,
  Portfolio,
  PerformanceMetrics,
  RiskMetrics,
  Transaction,
  RebalancingRecommendation,
  StressTestScenario,
} from "../types/portfolio"
import { MarketDataService } from "./market-data"
import { BenchmarkService } from "./benchmark"

export class PortfolioAnalyticsEngine {
  private marketDataService: MarketDataService
  private benchmarkService: BenchmarkService

  constructor() {
    this.marketDataService = new MarketDataService()
    this.benchmarkService = new BenchmarkService()
  }

  // Performance Analytics
  async calculatePerformanceMetrics(portfolio: Portfolio, timeframe = "1Y"): Promise<PerformanceMetrics> {
    const historicalData = await this.getHistoricalPortfolioData(portfolio, timeframe)
    const benchmarkData = await this.benchmarkService.getBenchmarkData(portfolio.benchmarkSymbol, timeframe)
    const riskFreeRate = await this.getRiskFreeRate()

    const returns = this.calculateReturns(historicalData)
    const benchmarkReturns = this.calculateReturns(benchmarkData)

    return {
      roi: this.calculateROI(portfolio),
      sharpeRatio: this.calculateSharpeRatio(returns, riskFreeRate),
      alpha: this.calculateAlpha(returns, benchmarkReturns, riskFreeRate),
      beta: this.calculateBeta(returns, benchmarkReturns),
      volatility: this.calculateVolatility(returns),
      var95: this.calculateVaR(returns, 0.95),
      var99: this.calculateVaR(returns, 0.99),
      maxDrawdown: this.calculateMaxDrawdown(historicalData),
      timeWeightedReturn: this.calculateTimeWeightedReturn(portfolio),
      moneyWeightedReturn: this.calculateMoneyWeightedReturn(portfolio),
      correlationMatrix: await this.calculateCorrelationMatrix(portfolio.assets),
    }
  }

  // Risk Assessment
  calculateRiskMetrics(portfolio: Portfolio, returns: number[]): RiskMetrics {
    const weights = portfolio.assets.map((asset) => asset.weight)
    const assetVolatilities = portfolio.assets.map((asset) => this.calculateAssetVolatility(asset))

    return {
      portfolioVolatility: this.calculatePortfolioVolatility(weights, assetVolatilities, portfolio),
      valueAtRisk: {
        var95: this.calculateVaR(returns, 0.95),
        var99: this.calculateVaR(returns, 0.99),
        expectedShortfall95: this.calculateExpectedShortfall(returns, 0.95),
        expectedShortfall99: this.calculateExpectedShortfall(returns, 0.99),
      },
      concentrationRisk: {
        herfindahlIndex: this.calculateHerfindahlIndex(weights),
        topHoldings: this.getTopHoldings(portfolio, 5),
      },
      diversificationRatio: this.calculateDiversificationRatio(portfolio),
      liquidityScore: this.calculateLiquidityScore(portfolio),
    }
  }

  // Individual Asset Analysis
  analyzeAssetPerformance(asset: Asset, transactions: Transaction[]): any {
    const assetTransactions = transactions.filter((t) => t.assetId === asset.id)

    return {
      totalReturn: ((asset.currentPrice - asset.averageCost) / asset.averageCost) * 100,
      unrealizedGainLoss: (asset.currentPrice - asset.averageCost) * asset.quantity,
      realizedGainLoss: this.calculateRealizedGainLoss(assetTransactions),
      holdingPeriod: this.calculateHoldingPeriod(assetTransactions),
      volatility: this.calculateAssetVolatility(asset),
      contribution: this.calculateAssetContribution(asset, transactions),
    }
  }

  // Sector and Category Analysis
  analyzeSectorAllocation(portfolio: Portfolio): any {
    const sectorAllocation = new Map<string, number>()
    const categoryAllocation = new Map<string, number>()

    portfolio.assets.forEach((asset) => {
      const sectorValue = sectorAllocation.get(asset.sector) || 0
      sectorAllocation.set(asset.sector, sectorValue + asset.marketValue)

      const categoryValue = categoryAllocation.get(asset.category) || 0
      categoryAllocation.set(asset.category, categoryValue + asset.marketValue)
    })

    return {
      sectorAllocation: this.convertToPercentages(sectorAllocation, portfolio.totalValue),
      categoryAllocation: this.convertToPercentages(categoryAllocation, portfolio.totalValue),
      diversificationScore: this.calculateDiversificationScore(sectorAllocation, categoryAllocation),
    }
  }

  // Rebalancing Recommendations
  generateRebalancingRecommendations(
    portfolio: Portfolio,
    targetAllocations: Record<string, number>,
  ): RebalancingRecommendation[] {
    const recommendations: RebalancingRecommendation[] = []
    const tolerance = 0.05 // 5% tolerance

    portfolio.assets.forEach((asset) => {
      const targetWeight = targetAllocations[asset.symbol] || 0
      const deviation = Math.abs(asset.weight - targetWeight)

      if (deviation > tolerance) {
        const recommendedAmount = (targetWeight - asset.weight) * portfolio.totalValue

        recommendations.push({
          assetId: asset.id,
          symbol: asset.symbol,
          currentWeight: asset.weight,
          targetWeight,
          recommendedAction: recommendedAmount > 0 ? "BUY" : "SELL",
          recommendedAmount: Math.abs(recommendedAmount),
          priority: deviation > 0.1 ? "HIGH" : deviation > 0.075 ? "MEDIUM" : "LOW",
        })
      }
    })

    return recommendations.sort((a, b) => {
      const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  // Drawdown Analysis
  calculateDrawdownAnalysis(historicalValues: number[]): any {
    const drawdowns: number[] = []
    const recoveryPeriods: number[] = []
    let peak = historicalValues[0]
    let peakIndex = 0
    let inDrawdown = false

    for (let i = 1; i < historicalValues.length; i++) {
      if (historicalValues[i] > peak) {
        if (inDrawdown) {
          recoveryPeriods.push(i - peakIndex)
          inDrawdown = false
        }
        peak = historicalValues[i]
        peakIndex = i
      } else {
        const drawdown = (peak - historicalValues[i]) / peak
        drawdowns.push(drawdown)
        if (!inDrawdown && drawdown > 0.01) {
          // 1% threshold
          inDrawdown = true
        }
      }
    }

    return {
      maxDrawdown: Math.max(...drawdowns),
      averageDrawdown: drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length,
      averageRecoveryPeriod: recoveryPeriods.reduce((a, b) => a + b, 0) / recoveryPeriods.length,
      currentDrawdown: drawdowns[drawdowns.length - 1] || 0,
      drawdownFrequency: drawdowns.filter((d) => d > 0.05).length, // 5% threshold
    }
  }

  // Stress Testing
  performStressTest(portfolio: Portfolio, scenarios: StressTestScenario[]): any {
    const results = scenarios.map((scenario) => {
      let portfolioImpact = 0

      portfolio.assets.forEach((asset) => {
        const shock = scenarios[0].shocks[asset.symbol] || 0
        const assetImpact = asset.marketValue * (shock / 100)
        portfolioImpact += assetImpact
      })

      return {
        scenarioName: scenario.name,
        expectedImpact: scenario.expectedPortfolioImpact,
        calculatedImpact: (portfolioImpact / portfolio.totalValue) * 100,
        impactDifference: Math.abs(scenario.expectedPortfolioImpact - (portfolioImpact / portfolio.totalValue) * 100),
        worstAffectedAssets: this.getWorstAffectedAssets(portfolio, scenario.shocks),
      }
    })

    return {
      scenarios: results,
      overallRiskScore: this.calculateOverallRiskScore(results),
      recommendations: this.generateStressTestRecommendations(results),
    }
  }

  // Tax-Loss Harvesting
  identifyTaxLossHarvestingOpportunities(portfolio: Portfolio, transactions: Transaction[]): any {
    const opportunities: any[] = []
    const currentDate = new Date()

    portfolio.assets.forEach((asset) => {
      const assetTransactions = transactions.filter((t) => t.assetId === asset.id && t.type === "BUY")

      assetTransactions.forEach((transaction) => {
        const holdingPeriod = (currentDate.getTime() - transaction.timestamp.getTime()) / (1000 * 60 * 60 * 24)
        const unrealizedLoss = (asset.currentPrice - transaction.price) * transaction.quantity

        if (unrealizedLoss < -1000 && holdingPeriod > 30) {
          // $1000 loss threshold and wash sale rule
          opportunities.push({
            assetId: asset.id,
            symbol: asset.symbol,
            purchasePrice: transaction.price,
            currentPrice: asset.currentPrice,
            quantity: transaction.quantity,
            unrealizedLoss,
            holdingPeriod,
            taxSavings: unrealizedLoss * 0.25, // Assuming 25% tax rate
            washSaleRisk: holdingPeriod < 31 ? "HIGH" : "LOW",
          })
        }
      })
    })

    return {
      opportunities: opportunities.sort((a, b) => a.unrealizedLoss - b.unrealizedLoss),
      totalPotentialLoss: opportunities.reduce((sum, opp) => sum + opp.unrealizedLoss, 0),
      totalTaxSavings: opportunities.reduce((sum, opp) => sum + opp.taxSavings, 0),
    }
  }

  // Helper Methods
  private calculateROI(portfolio: Portfolio): number {
    return ((portfolio.totalValue - portfolio.totalCost) / portfolio.totalCost) * 100
  }

  private calculateSharpeRatio(returns: number[], riskFreeRate: number): number {
    const excessReturns = returns.map((r) => r - riskFreeRate)
    const avgExcessReturn = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length
    const volatility = this.calculateVolatility(excessReturns)
    return avgExcessReturn / volatility
  }

  private calculateAlpha(portfolioReturns: number[], benchmarkReturns: number[], riskFreeRate: number): number {
    const beta = this.calculateBeta(portfolioReturns, benchmarkReturns)
    const avgPortfolioReturn = portfolioReturns.reduce((a, b) => a + b, 0) / portfolioReturns.length
    const avgBenchmarkReturn = benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length

    return avgPortfolioReturn - (riskFreeRate + beta * (avgBenchmarkReturn - riskFreeRate))
  }

  private calculateBeta(portfolioReturns: number[], benchmarkReturns: number[]): number {
    const n = Math.min(portfolioReturns.length, benchmarkReturns.length)
    const portfolioMean = portfolioReturns.slice(0, n).reduce((a, b) => a + b, 0) / n
    const benchmarkMean = benchmarkReturns.slice(0, n).reduce((a, b) => a + b, 0) / n

    let covariance = 0
    let benchmarkVariance = 0

    for (let i = 0; i < n; i++) {
      const portfolioDiff = portfolioReturns[i] - portfolioMean
      const benchmarkDiff = benchmarkReturns[i] - benchmarkMean
      covariance += portfolioDiff * benchmarkDiff
      benchmarkVariance += benchmarkDiff * benchmarkDiff
    }

    return covariance / (n - 1) / (benchmarkVariance / (n - 1))
  }

  private calculateVolatility(returns: number[]): number {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1)
    return Math.sqrt(variance)
  }

  private calculateVaR(returns: number[], confidence: number): number {
    const sortedReturns = [...returns].sort((a, b) => a - b)
    const index = Math.floor((1 - confidence) * sortedReturns.length)
    return sortedReturns[index]
  }

  private calculateExpectedShortfall(returns: number[], confidence: number): number {
    const valueAtRisk = this.calculateVaR(returns, confidence)
    const tailReturns = returns.filter((r) => r <= valueAtRisk)
    return tailReturns.reduce((a, b) => a + b, 0) / tailReturns.length
  }

  private calculateMaxDrawdown(historicalValues: number[]): number {
    let maxDrawdown = 0
    let peak = historicalValues[0]

    for (let i = 1; i < historicalValues.length; i++) {
      if (historicalValues[i] > peak) {
        peak = historicalValues[i]
      } else {
        const drawdown = (peak - historicalValues[i]) / peak
        maxDrawdown = Math.max(maxDrawdown, drawdown)
      }
    }

    return maxDrawdown
  }

  private calculateTimeWeightedReturn(portfolio: Portfolio): number {
    // Simplified implementation - would need more detailed transaction history
    return this.calculateROI(portfolio)
  }

  private calculateMoneyWeightedReturn(portfolio: Portfolio): number {
    // Simplified implementation - would need cash flow analysis
    return this.calculateROI(portfolio)
  }

  private async calculateCorrelationMatrix(assets: Asset[]): Promise<Record<string, Record<string, number>>> {
    const matrix: Record<string, Record<string, number>> = {}

    for (const asset1 of assets) {
      matrix[asset1.symbol] = {}
      for (const asset2 of assets) {
        if (asset1.symbol === asset2.symbol) {
          matrix[asset1.symbol][asset2.symbol] = 1
        } else {
          // This would require historical price data for both assets
          matrix[asset1.symbol][asset2.symbol] = Math.random() * 0.8 - 0.4 // Placeholder
        }
      }
    }

    return matrix
  }

  private calculateHerfindahlIndex(weights: number[]): number {
    return weights.reduce((sum, weight) => sum + weight * weight, 0)
  }

  private getTopHoldings(portfolio: Portfolio, count: number): Array<{ symbol: string; weight: number }> {
    return portfolio.assets
      .sort((a, b) => b.weight - a.weight)
      .slice(0, count)
      .map((asset) => ({ symbol: asset.symbol, weight: asset.weight }))
  }

  private calculateDiversificationRatio(portfolio: Portfolio): number {
    const weightedAvgVolatility = portfolio.assets.reduce((sum, asset) => {
      return sum + asset.weight * this.calculateAssetVolatility(asset)
    }, 0)

    const portfolioVolatility = this.calculatePortfolioVolatility(
      portfolio.assets.map((a) => a.weight),
      portfolio.assets.map((a) => this.calculateAssetVolatility(a)),
      portfolio,
    )

    return weightedAvgVolatility / portfolioVolatility
  }

  private calculateLiquidityScore(portfolio: Portfolio): number {
    // Simplified liquidity scoring based on market cap and volume
    return portfolio.assets.reduce((sum, asset) => {
      const liquidityScore = Math.min(asset.marketValue / 1000000, 1) // Normalize by $1M
      return sum + asset.weight * liquidityScore
    }, 0)
  }

  private calculateAssetVolatility(asset: Asset): number {
    // This would require historical price data
    return 0.2 // Placeholder 20% volatility
  }

  private calculatePortfolioVolatility(weights: number[], volatilities: number[], portfolio: Portfolio): number {
    // Simplified calculation - would need full covariance matrix
    const weightedVolatility = weights.reduce((sum, weight, i) => {
      return sum + weight * weight * volatilities[i] * volatilities[i]
    }, 0)

    return Math.sqrt(weightedVolatility)
  }

  private calculateRealizedGainLoss(transactions: Transaction[]): number {
    let realizedGainLoss = 0
    const buyTransactions = transactions.filter((t) => t.type === "BUY")
    const sellTransactions = transactions.filter((t) => t.type === "SELL")

    // FIFO method for calculating realized gains/losses
    const remainingShares = [...buyTransactions]

    sellTransactions.forEach((sell) => {
      let sharesToSell = sell.quantity

      while (sharesToSell > 0 && remainingShares.length > 0) {
        const buy = remainingShares[0]
        const sharesToUse = Math.min(sharesToSell, buy.quantity)

        realizedGainLoss += sharesToUse * (sell.price - buy.price)

        buy.quantity -= sharesToUse
        sharesToSell -= sharesToUse

        if (buy.quantity === 0) {
          remainingShares.shift()
        }
      }
    })

    return realizedGainLoss
  }

  private calculateHoldingPeriod(transactions: Transaction[]): number {
    const firstBuy = transactions
      .filter((t) => t.type === "BUY")
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0]
    if (!firstBuy) return 0

    return (Date.now() - firstBuy.timestamp.getTime()) / (1000 * 60 * 60 * 24)
  }

  private calculateAssetContribution(asset: Asset, transactions: Transaction[]): number {
    // Calculate the asset's contribution to overall portfolio performance
    const assetReturn = (asset.currentPrice - asset.averageCost) / asset.averageCost
    return asset.weight * assetReturn
  }

  private convertToPercentages(allocation: Map<string, number>, totalValue: number): Record<string, number> {
    const result: Record<string, number> = {}
    allocation.forEach((value, key) => {
      result[key] = (value / totalValue) * 100
    })
    return result
  }

  private calculateDiversificationScore(
    sectorAllocation: Map<string, number>,
    categoryAllocation: Map<string, number>,
  ): number {
    const sectorHHI = this.calculateHerfindahlIndex(Array.from(sectorAllocation.values()))
    const categoryHHI = this.calculateHerfindahlIndex(Array.from(categoryAllocation.values()))

    // Higher score means better diversification (lower HHI)
    return (2 - sectorHHI - categoryHHI) / 2
  }

  private getWorstAffectedAssets(
    portfolio: Portfolio,
    shocks: Record<string, number>,
  ): Array<{ symbol: string; impact: number }> {
    return portfolio.assets
      .map((asset) => ({
        symbol: asset.symbol,
        impact: (shocks[asset.symbol] || 0) * asset.weight,
      }))
      .sort((a, b) => a.impact - b.impact)
      .slice(0, 5)
  }

  private calculateOverallRiskScore(stressTestResults: any[]): number {
    const avgImpact =
      stressTestResults.reduce((sum, result) => sum + Math.abs(result.calculatedImpact), 0) / stressTestResults.length
    return Math.min(avgImpact / 10, 10) // Scale to 0-10
  }

  private generateStressTestRecommendations(results: any[]): string[] {
    const recommendations: string[] = []

    const highImpactScenarios = results.filter((r) => Math.abs(r.calculatedImpact) > 15)
    if (highImpactScenarios.length > 0) {
      recommendations.push("Consider reducing concentration in high-risk assets")
      recommendations.push("Increase diversification across sectors and asset classes")
    }

    return recommendations
  }

  private async getHistoricalPortfolioData(portfolio: Portfolio, timeframe: string): Promise<number[]> {
    // This would fetch actual historical portfolio values
    // For now, return mock data
    const days = timeframe === "1Y" ? 365 : timeframe === "6M" ? 180 : 90
    const data: number[] = []
    let value = portfolio.totalValue * 0.8 // Start 20% lower

    for (let i = 0; i < days; i++) {
      value *= 1 + (Math.random() - 0.5) * 0.02 // Random walk
      data.push(value)
    }

    return data
  }

  private calculateReturns(values: number[]): number[] {
    const returns: number[] = []
    for (let i = 1; i < values.length; i++) {
      returns.push((values[i] - values[i - 1]) / values[i - 1])
    }
    return returns
  }

  private async getRiskFreeRate(): Promise<number> {
    // This would fetch current risk-free rate (e.g., 10-year Treasury)
    return 0.04 // 4% placeholder
  }
}
