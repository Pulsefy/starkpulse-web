// Advanced portfolio analytics and performance tracking

import type {
  ExtendedPortfolio,
  PortfolioPerformance,
  PortfolioSnapshot,
  RebalanceRecommendation,
} from "../types/portfolio-extended"
import type { RiskMetrics } from "../types/risk"

export class PortfolioAnalytics {
  private snapshots: Map<string, PortfolioSnapshot[]> = new Map()

  /**
   * Record portfolio snapshot for historical tracking
   */
  public recordSnapshot(portfolio: ExtendedPortfolio, riskMetrics: RiskMetrics): void {
    const snapshot: PortfolioSnapshot = {
      portfolioId: portfolio.id,
      timestamp: new Date(),
      totalValue: portfolio.totalValue,
      positions: portfolio.positions.map((pos) => ({
        symbol: pos.symbol,
        quantity: pos.quantity,
        price: pos.price,
        marketValue: pos.marketValue,
        weight: pos.weight,
      })),
      riskMetrics: {
        var95: riskMetrics.var95,
        volatility: riskMetrics.volatility,
        sharpeRatio: riskMetrics.sharpeRatio,
        maxDrawdown: riskMetrics.maxDrawdown,
      },
    }

    const portfolioSnapshots = this.snapshots.get(portfolio.id) || []
    portfolioSnapshots.push(snapshot)

    // Keep only last 1000 snapshots to manage memory
    if (portfolioSnapshots.length > 1000) {
      portfolioSnapshots.shift()
    }

    this.snapshots.set(portfolio.id, portfolioSnapshots)
  }

  /**
   * Calculate portfolio performance metrics
   */
  public calculatePerformance(
    portfolioId: string,
    period: "1d" | "1w" | "1m" | "3m" | "6m" | "1y" | "ytd" | "all",
  ): PortfolioPerformance | null {
    const snapshots = this.snapshots.get(portfolioId)
    if (!snapshots || snapshots.length < 2) {
      return null
    }

    const filteredSnapshots = this.filterSnapshotsByPeriod(snapshots, period)
    if (filteredSnapshots.length < 2) {
      return null
    }

    const startSnapshot = filteredSnapshots[0]
    const endSnapshot = filteredSnapshots[filteredSnapshots.length - 1]

    const totalReturn = endSnapshot.totalValue - startSnapshot.totalValue
    const totalReturnPercent = (totalReturn / startSnapshot.totalValue) * 100

    const returns = this.calculateReturns(filteredSnapshots)
    const volatility = this.calculateVolatility(returns)
    const sharpeRatio = this.calculateSharpeRatio(returns)
    const maxDrawdown = this.calculateMaxDrawdown(filteredSnapshots)

    const daysDiff = Math.max(
      1,
      (endSnapshot.timestamp.getTime() - startSnapshot.timestamp.getTime()) / (1000 * 60 * 60 * 24),
    )
    const annualizedReturn = Math.pow(1 + totalReturnPercent / 100, 365 / daysDiff) - 1

    return {
      portfolioId,
      period,
      totalReturn,
      totalReturnPercent,
      annualizedReturn: annualizedReturn * 100,
      volatility: volatility * 100,
      sharpeRatio,
      maxDrawdown: maxDrawdown * 100,
      winRate: this.calculateWinRate(returns),
      bestDay: Math.max(...returns) * 100,
      worstDay: Math.min(...returns) * 100,
    }
  }

  /**
   * Generate rebalancing recommendations
   */
  public generateRebalanceRecommendations(portfolio: ExtendedPortfolio): RebalanceRecommendation[] {
    const recommendations: RebalanceRecommendation[] = []

    // Check target allocation deviation
    if (portfolio.targetAllocation) {
      const deviationRecommendation = this.checkAllocationDeviation(portfolio)
      if (deviationRecommendation) {
        recommendations.push(deviationRecommendation)
      }
    }

    // Check concentration risk
    const concentrationRecommendation = this.checkConcentrationRisk(portfolio)
    if (concentrationRecommendation) {
      recommendations.push(concentrationRecommendation)
    }

    // Check risk profile alignment
    const riskAlignmentRecommendation = this.checkRiskProfileAlignment(portfolio)
    if (riskAlignmentRecommendation) {
      recommendations.push(riskAlignmentRecommendation)
    }

    return recommendations
  }

  /**
   * Get portfolio attribution analysis
   */
  public getAttributionAnalysis(portfolioId: string, period: "1m" | "3m" | "6m" | "1y") {
    const snapshots = this.snapshots.get(portfolioId)
    if (!snapshots || snapshots.length < 2) {
      return null
    }

    const filteredSnapshots = this.filterSnapshotsByPeriod(snapshots, period)
    const startSnapshot = filteredSnapshots[0]
    const endSnapshot = filteredSnapshots[filteredSnapshots.length - 1]

    const positionContributions = endSnapshot.positions
      .map((endPos) => {
        const startPos = startSnapshot.positions.find((p) => p.symbol === endPos.symbol)
        if (!startPos) return null

        const positionReturn = (endPos.price - startPos.price) / startPos.price
        const avgWeight = (startPos.weight + endPos.weight) / 2
        const contribution = positionReturn * avgWeight

        return {
          symbol: endPos.symbol,
          return: positionReturn * 100,
          weight: avgWeight * 100,
          contribution: contribution * 100,
        }
      })
      .filter(Boolean)

    return {
      portfolioId,
      period,
      positionContributions: positionContributions.sort((a, b) => (b?.contribution || 0) - (a?.contribution || 0)),
    }
  }

  // Private helper methods
  private filterSnapshotsByPeriod(snapshots: PortfolioSnapshot[], period: string): PortfolioSnapshot[] {
    const now = new Date()
    let startDate: Date

    switch (period) {
      case "1d":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case "1w":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "1m":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "3m":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case "6m":
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        break
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      case "ytd":
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        return snapshots
    }

    return snapshots.filter((snapshot) => snapshot.timestamp >= startDate)
  }

  private calculateReturns(snapshots: PortfolioSnapshot[]): number[] {
    const returns: number[] = []
    for (let i = 1; i < snapshots.length; i++) {
      const prevValue = snapshots[i - 1].totalValue
      const currentValue = snapshots[i].totalValue
      returns.push((currentValue - prevValue) / prevValue)
    }
    return returns
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (returns.length - 1)

    return Math.sqrt(variance)
  }

  private calculateSharpeRatio(returns: number[], riskFreeRate = 0.02): number {
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
    const volatility = this.calculateVolatility(returns)

    if (volatility === 0) return 0

    const annualizedReturn = avgReturn * 252
    const annualizedVolatility = volatility * Math.sqrt(252)

    return (annualizedReturn - riskFreeRate) / annualizedVolatility
  }

  private calculateMaxDrawdown(snapshots: PortfolioSnapshot[]): number {
    let peak = snapshots[0].totalValue
    let maxDrawdown = 0

    for (const snapshot of snapshots) {
      peak = Math.max(peak, snapshot.totalValue)
      const drawdown = (peak - snapshot.totalValue) / peak
      maxDrawdown = Math.max(maxDrawdown, drawdown)
    }

    return maxDrawdown
  }

  private calculateWinRate(returns: number[]): number {
    const positiveReturns = returns.filter((ret) => ret > 0).length
    return returns.length > 0 ? (positiveReturns / returns.length) * 100 : 0
  }

  private checkAllocationDeviation(portfolio: ExtendedPortfolio): RebalanceRecommendation | null {
    if (!portfolio.targetAllocation) return null

    const significantDeviations = portfolio.targetAllocation.filter(
      (allocation) => Math.abs(allocation.deviation) > 0.05, // 5% deviation threshold
    )

    if (significantDeviations.length === 0) return null

    const trades = significantDeviations.map((allocation) => ({
      symbol: allocation.sector, // Simplified - would need sector-to-symbol mapping
      action: allocation.deviation > 0 ? "sell" : ("buy" as "buy" | "sell"),
      quantity: 0, // Would calculate based on deviation
      currentWeight: allocation.currentWeight,
      targetWeight: allocation.targetWeight,
      rationale: `Rebalance ${allocation.sector} from ${(allocation.currentWeight * 100).toFixed(1)}% to ${(allocation.targetWeight * 100).toFixed(1)}%`,
    }))

    return {
      portfolioId: portfolio.id,
      reason: "Target allocation deviation detected",
      urgency: "medium",
      trades,
      expectedImpact: {
        riskReduction: 0.05,
        costEstimate: trades.length * 10, // Simplified cost estimate
        taxImplications: 0,
      },
      generatedAt: new Date(),
    }
  }

  private checkConcentrationRisk(portfolio: ExtendedPortfolio): RebalanceRecommendation | null {
    const concentrationThreshold = 0.2 // 20%
    const concentratedPositions = portfolio.positions.filter((pos) => pos.weight > concentrationThreshold)

    if (concentratedPositions.length === 0) return null

    const trades = concentratedPositions.map((pos) => ({
      symbol: pos.symbol,
      action: "sell" as "buy" | "sell",
      quantity: Math.floor((pos.quantity * (pos.weight - concentrationThreshold)) / pos.weight),
      currentWeight: pos.weight,
      targetWeight: concentrationThreshold,
      rationale: `Reduce concentration risk in ${pos.symbol}`,
    }))

    return {
      portfolioId: portfolio.id,
      reason: "High concentration risk detected",
      urgency: "high",
      trades,
      expectedImpact: {
        riskReduction: 0.15,
        costEstimate: trades.length * 15,
        taxImplications: 0,
      },
      generatedAt: new Date(),
    }
  }

  private checkRiskProfileAlignment(portfolio: ExtendedPortfolio): RebalanceRecommendation | null {
    // Simplified risk profile check - would use actual risk metrics
    const highRiskPositions = portfolio.positions.filter(
      (pos) => "riskRating" in pos && (pos as any).riskRating === "high",
    )

    if (portfolio.riskProfile === "conservative" && highRiskPositions.length > 0) {
      const trades = highRiskPositions.map((pos) => ({
        symbol: pos.symbol,
        action: "sell" as "buy" | "sell",
        quantity: pos.quantity,
        currentWeight: pos.weight,
        targetWeight: 0,
        rationale: `High-risk position not aligned with conservative profile`,
      }))

      return {
        portfolioId: portfolio.id,
        reason: "Risk profile misalignment",
        urgency: "medium",
        trades,
        expectedImpact: {
          riskReduction: 0.2,
          costEstimate: trades.length * 12,
          taxImplications: 0,
        },
        generatedAt: new Date(),
      }
    }

    return null
  }
}
