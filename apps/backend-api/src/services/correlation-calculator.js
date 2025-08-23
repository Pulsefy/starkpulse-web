// Correlation and covariance matrix calculations

import { MarketDataService } from "./market-data-service"
import type { Portfolio } from "../types/risk"

export interface CorrelationMatrix {
  symbols: string[]
  matrix: number[][]
  calculatedAt: Date
}

export interface CovarianceMatrix {
  symbols: string[]
  matrix: number[][]
  calculatedAt: Date
}

export interface RiskDecomposition {
  portfolioId: string
  totalRisk: number
  componentRisks: ComponentRisk[]
  diversificationBenefit: number
  calculatedAt: Date
}

export interface ComponentRisk {
  symbol: string
  weight: number
  standaloneRisk: number
  contributionToRisk: number
  marginalRisk: number
  componentVaR: number
}

export class CorrelationCalculator {
  private marketDataService: MarketDataService

  constructor() {
    this.marketDataService = MarketDataService.getInstance()
  }

  /**
   * Calculate correlation matrix for portfolio assets
   */
  public calculateCorrelationMatrix(symbols: string[], days = 252): CorrelationMatrix {
    const returns: number[][] = []

    // Get returns for each symbol
    for (const symbol of symbols) {
      returns.push(this.marketDataService.calculateReturns(symbol, days))
    }

    // Ensure all return series have the same length
    const minLength = Math.min(...returns.map((r) => r.length))
    const trimmedReturns = returns.map((r) => r.slice(-minLength))

    // Calculate correlation matrix
    const matrix: number[][] = []

    for (let i = 0; i < symbols.length; i++) {
      matrix[i] = []
      for (let j = 0; j < symbols.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0
        } else {
          matrix[i][j] = this.calculateCorrelation(trimmedReturns[i], trimmedReturns[j])
        }
      }
    }

    return {
      symbols,
      matrix,
      calculatedAt: new Date(),
    }
  }

  /**
   * Calculate covariance matrix for portfolio assets
   */
  public calculateCovarianceMatrix(symbols: string[], days = 252): CovarianceMatrix {
    const returns: number[][] = []

    // Get returns for each symbol
    for (const symbol of symbols) {
      returns.push(this.marketDataService.calculateReturns(symbol, days))
    }

    // Ensure all return series have the same length
    const minLength = Math.min(...returns.map((r) => r.length))
    const trimmedReturns = returns.map((r) => r.slice(-minLength))

    // Calculate covariance matrix
    const matrix: number[][] = []

    for (let i = 0; i < symbols.length; i++) {
      matrix[i] = []
      for (let j = 0; j < symbols.length; j++) {
        matrix[i][j] = this.calculateCovariance(trimmedReturns[i], trimmedReturns[j])
      }
    }

    return {
      symbols,
      matrix,
      calculatedAt: new Date(),
    }
  }

  /**
   * Decompose portfolio risk into individual components
   */
  public decomposeRisk(portfolio: Portfolio): RiskDecomposition {
    const symbols = portfolio.positions.map((p) => p.symbol)
    const weights = portfolio.positions.map((p) => p.weight)
    const covarianceMatrix = this.calculateCovarianceMatrix(symbols)

    // Calculate portfolio variance
    let portfolioVariance = 0
    for (let i = 0; i < symbols.length; i++) {
      for (let j = 0; j < symbols.length; j++) {
        portfolioVariance += weights[i] * weights[j] * covarianceMatrix.matrix[i][j]
      }
    }

    const portfolioRisk = Math.sqrt(portfolioVariance) * Math.sqrt(252) // Annualized

    // Calculate component risks
    const componentRisks: ComponentRisk[] = []
    let totalComponentRisk = 0

    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i]
      const weight = weights[i]

      // Standalone risk (volatility)
      const returns = this.marketDataService.calculateReturns(symbol)
      const standaloneRisk = this.calculateVolatility(returns) * Math.sqrt(252)

      // Marginal contribution to risk
      let marginalRisk = 0
      for (let j = 0; j < symbols.length; j++) {
        marginalRisk += weights[j] * covarianceMatrix.matrix[i][j]
      }
      marginalRisk = marginalRisk / portfolioRisk

      // Component contribution to risk
      const contributionToRisk = weight * marginalRisk

      // Component VaR (simplified)
      const componentVaR = contributionToRisk * portfolio.totalValue * 1.645 // 95% confidence

      componentRisks.push({
        symbol,
        weight,
        standaloneRisk,
        contributionToRisk,
        marginalRisk,
        componentVaR,
      })

      totalComponentRisk += Math.abs(contributionToRisk)
    }

    // Diversification benefit
    const undiversifiedRisk = componentRisks.reduce((sum, comp) => sum + comp.weight * comp.standaloneRisk, 0)
    const diversificationBenefit = undiversifiedRisk - portfolioRisk

    return {
      portfolioId: portfolio.id,
      totalRisk: portfolioRisk,
      componentRisks,
      diversificationBenefit,
      calculatedAt: new Date(),
    }
  }

  /**
   * Calculate rolling correlation between two assets
   */
  public calculateRollingCorrelation(symbol1: string, symbol2: string, window = 30, days = 252): number[] {
    const returns1 = this.marketDataService.calculateReturns(symbol1, days)
    const returns2 = this.marketDataService.calculateReturns(symbol2, days)

    const minLength = Math.min(returns1.length, returns2.length)
    const rollingCorrelations: number[] = []

    for (let i = window; i <= minLength; i++) {
      const windowReturns1 = returns1.slice(i - window, i)
      const windowReturns2 = returns2.slice(i - window, i)
      const correlation = this.calculateCorrelation(windowReturns1, windowReturns2)
      rollingCorrelations.push(correlation)
    }

    return rollingCorrelations
  }

  // Helper methods
  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0

    const meanX = x.reduce((sum, val) => sum + val, 0) / x.length
    const meanY = y.reduce((sum, val) => sum + val, 0) / y.length

    let numerator = 0
    let sumSqX = 0
    let sumSqY = 0

    for (let i = 0; i < x.length; i++) {
      const diffX = x[i] - meanX
      const diffY = y[i] - meanY
      numerator += diffX * diffY
      sumSqX += diffX * diffX
      sumSqY += diffY * diffY
    }

    const denominator = Math.sqrt(sumSqX * sumSqY)
    return denominator === 0 ? 0 : numerator / denominator
  }

  private calculateCovariance(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0

    const meanX = x.reduce((sum, val) => sum + val, 0) / x.length
    const meanY = y.reduce((sum, val) => sum + val, 0) / y.length

    return x.reduce((sum, val, i) => sum + (val - meanX) * (y[i] - meanY), 0) / (x.length - 1)
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (returns.length - 1)

    return Math.sqrt(variance)
  }
}
