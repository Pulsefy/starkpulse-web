// Core Risk Calculation Engine

import type { Portfolio, RiskMetrics } from "../types/risk"

export class RiskEngine {
  private static instance: RiskEngine
  private marketData: Map<string, number[]> = new Map() // Historical prices
  private correlationMatrix: Map<string, Map<string, number>> = new Map()

  private constructor() {}

  public static getInstance(): RiskEngine {
    if (!RiskEngine.instance) {
      RiskEngine.instance = new RiskEngine()
    }
    return RiskEngine.instance
  }

  /**
   * Calculate comprehensive risk metrics for a portfolio
   */
  public async calculateRiskMetrics(portfolio: Portfolio): Promise<RiskMetrics> {
    const returns = this.calculatePortfolioReturns(portfolio)
    const volatility = this.calculateVolatility(returns)

    return {
      portfolioId: portfolio.id,
      var95: this.calculateVaR(returns, 0.95),
      var99: this.calculateVaR(returns, 0.99),
      cvar95: this.calculateCVaR(returns, 0.95),
      cvar99: this.calculateCVaR(returns, 0.99),
      volatility,
      sharpeRatio: this.calculateSharpeRatio(returns),
      maxDrawdown: this.calculateMaxDrawdown(returns),
      beta: await this.calculateBeta(portfolio),
      correlationRisk: this.calculateCorrelationRisk(portfolio),
      concentrationRisk: this.calculateConcentrationRisk(portfolio),
      liquidityRisk: this.calculateLiquidityRisk(portfolio),
      calculatedAt: new Date(),
    }
  }

  /**
   * Calculate Value at Risk using historical simulation
   */
  private calculateVaR(returns: number[], confidence: number): number {
    const sortedReturns = [...returns].sort((a, b) => a - b)
    const index = Math.floor((1 - confidence) * sortedReturns.length)
    return Math.abs(sortedReturns[index] || 0)
  }

  /**
   * Calculate Conditional Value at Risk (Expected Shortfall)
   */
  private calculateCVaR(returns: number[], confidence: number): number {
    const sortedReturns = [...returns].sort((a, b) => a - b)
    const cutoffIndex = Math.floor((1 - confidence) * sortedReturns.length)
    const tailReturns = sortedReturns.slice(0, cutoffIndex)

    if (tailReturns.length === 0) return 0

    const avgTailReturn = tailReturns.reduce((sum, ret) => sum + ret, 0) / tailReturns.length
    return Math.abs(avgTailReturn)
  }

  /**
   * Calculate portfolio volatility (standard deviation of returns)
   */
  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (returns.length - 1)

    return Math.sqrt(variance) * Math.sqrt(252) // Annualized
  }

  /**
   * Calculate Sharpe ratio
   */
  private calculateSharpeRatio(returns: number[], riskFreeRate = 0.02): number {
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
    const volatility = this.calculateVolatility(returns) / Math.sqrt(252) // Daily volatility

    if (volatility === 0) return 0

    const annualizedReturn = avgReturn * 252
    return (annualizedReturn - riskFreeRate) / (volatility * Math.sqrt(252))
  }

  /**
   * Calculate maximum drawdown
   */
  private calculateMaxDrawdown(returns: number[]): number {
    let peak = 0
    let maxDrawdown = 0
    let cumulativeReturn = 0

    for (const ret of returns) {
      cumulativeReturn += ret
      peak = Math.max(peak, cumulativeReturn)
      const drawdown = peak - cumulativeReturn
      maxDrawdown = Math.max(maxDrawdown, drawdown)
    }

    return maxDrawdown
  }

  /**
   * Calculate portfolio beta relative to market
   */
  private async calculateBeta(portfolio: Portfolio): Promise<number> {
    // Simplified beta calculation - would need market index data in production
    const portfolioReturns = this.calculatePortfolioReturns(portfolio)
    const marketReturns = this.getMarketReturns() // Mock market returns

    if (portfolioReturns.length !== marketReturns.length || portfolioReturns.length < 2) {
      return 1.0 // Default beta
    }

    const covariance = this.calculateCovariance(portfolioReturns, marketReturns)
    const marketVariance = this.calculateVariance(marketReturns)

    return marketVariance === 0 ? 1.0 : covariance / marketVariance
  }

  /**
   * Calculate concentration risk based on position weights
   */
  private calculateConcentrationRisk(portfolio: Portfolio): number {
    const weights = portfolio.positions.map((pos) => pos.weight)

    // Herfindahl-Hirschman Index for concentration
    const hhi = weights.reduce((sum, weight) => sum + Math.pow(weight, 2), 0)

    // Normalize to 0-1 scale where 1 is maximum concentration
    return Math.min(hhi, 1.0)
  }

  /**
   * Calculate correlation risk
   */
  private calculateCorrelationRisk(portfolio: Portfolio): number {
    // Simplified correlation risk - average pairwise correlation
    let totalCorrelation = 0
    let pairCount = 0

    for (let i = 0; i < portfolio.positions.length; i++) {
      for (let j = i + 1; j < portfolio.positions.length; j++) {
        const correlation = this.getCorrelation(portfolio.positions[i].symbol, portfolio.positions[j].symbol)
        totalCorrelation += Math.abs(correlation)
        pairCount++
      }
    }

    return pairCount === 0 ? 0 : totalCorrelation / pairCount
  }

  /**
   * Calculate liquidity risk based on position sizes and market liquidity
   */
  private calculateLiquidityRisk(portfolio: Portfolio): number {
    // Simplified liquidity risk calculation
    const totalValue = portfolio.totalValue
    let liquidityScore = 0

    for (const position of portfolio.positions) {
      const positionWeight = position.marketValue / totalValue
      const liquidityPenalty = this.getLiquidityPenalty(position.symbol)
      liquidityScore += positionWeight * liquidityPenalty
    }

    return Math.min(liquidityScore, 1.0)
  }

  // Helper methods
  private calculatePortfolioReturns(portfolio: Portfolio): number[] {
    // Mock implementation - would use actual historical data
    return Array.from({ length: 252 }, () => (Math.random() - 0.5) * 0.02)
  }

  private getMarketReturns(): number[] {
    // Mock market returns - would use actual market index data
    return Array.from({ length: 252 }, () => (Math.random() - 0.5) * 0.015)
  }

  private calculateCovariance(x: number[], y: number[]): number {
    const meanX = x.reduce((sum, val) => sum + val, 0) / x.length
    const meanY = y.reduce((sum, val) => sum + val, 0) / y.length

    return x.reduce((sum, val, i) => sum + (val - meanX) * (y[i] - meanY), 0) / (x.length - 1)
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1)
  }

  private getCorrelation(symbol1: string, symbol2: string): number {
    // Mock correlation - would use actual correlation matrix
    return Math.random() * 0.8 - 0.4 // Random correlation between -0.4 and 0.4
  }

  private getLiquidityPenalty(symbol: string): number {
    // Mock liquidity penalty - would use actual liquidity metrics
    return Math.random() * 0.3 // Random penalty between 0 and 0.3
  }
}
