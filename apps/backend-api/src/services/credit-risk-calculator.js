// Credit risk assessment and calculations

import type { Portfolio } from "../types/risk"

export interface CreditRiskMetrics {
  portfolioId: string
  totalCreditExposure: number
  averageCreditRating: string
  creditVaR: number
  expectedLoss: number
  unexpectedLoss: number
  concentrationRisk: number
  counterpartyExposures: CounterpartyExposure[]
  calculatedAt: Date
}

export interface CounterpartyExposure {
  counterparty: string
  exposure: number
  creditRating: string
  probabilityOfDefault: number
  lossGivenDefault: number
  expectedLoss: number
  riskContribution: number
}

export interface CreditRating {
  rating: string
  probabilityOfDefault: number
  lossGivenDefault: number
  riskWeight: number
}

export class CreditRiskCalculator {
  private creditRatings: Map<string, CreditRating> = new Map()

  constructor() {
    this.initializeCreditRatings()
  }

  /**
   * Calculate comprehensive credit risk metrics
   */
  public calculateCreditRisk(portfolio: Portfolio): CreditRiskMetrics {
    const counterpartyExposures = this.calculateCounterpartyExposures(portfolio)
    const totalCreditExposure = counterpartyExposures.reduce((sum, exp) => sum + exp.exposure, 0)

    // Calculate weighted average credit rating
    const averageCreditRating = this.calculateAverageCreditRating(counterpartyExposures)

    // Calculate expected and unexpected losses
    const expectedLoss = counterpartyExposures.reduce((sum, exp) => sum + exp.expectedLoss, 0)
    const unexpectedLoss = this.calculateUnexpectedLoss(counterpartyExposures)

    // Credit VaR (99% confidence level)
    const creditVaR = expectedLoss + 2.33 * unexpectedLoss // 99% confidence

    // Concentration risk (Herfindahl index)
    const concentrationRisk = this.calculateConcentrationRisk(counterpartyExposures, totalCreditExposure)

    return {
      portfolioId: portfolio.id,
      totalCreditExposure,
      averageCreditRating,
      creditVaR,
      expectedLoss,
      unexpectedLoss,
      concentrationRisk,
      counterpartyExposures,
      calculatedAt: new Date(),
    }
  }

  /**
   * Calculate credit exposure by counterparty
   */
  private calculateCounterpartyExposures(portfolio: Portfolio): CounterpartyExposure[] {
    const exposureMap = new Map<string, number>()

    // Group positions by counterparty (simplified - using sector as proxy)
    for (const position of portfolio.positions) {
      const counterparty = position.sector || "Unknown"
      const currentExposure = exposureMap.get(counterparty) || 0
      exposureMap.set(counterparty, currentExposure + position.marketValue)
    }

    const counterpartyExposures: CounterpartyExposure[] = []

    for (const [counterparty, exposure] of exposureMap.entries()) {
      const creditRating = this.getCreditRating(counterparty)
      const expectedLoss = exposure * creditRating.probabilityOfDefault * creditRating.lossGivenDefault

      counterpartyExposures.push({
        counterparty,
        exposure,
        creditRating: creditRating.rating,
        probabilityOfDefault: creditRating.probabilityOfDefault,
        lossGivenDefault: creditRating.lossGivenDefault,
        expectedLoss,
        riskContribution: expectedLoss / portfolio.totalValue,
      })
    }

    return counterpartyExposures.sort((a, b) => b.exposure - a.exposure)
  }

  /**
   * Calculate unexpected loss (credit risk volatility)
   */
  private calculateUnexpectedLoss(exposures: CounterpartyExposure[]): number {
    let variance = 0

    for (const exposure of exposures) {
      const pd = exposure.probabilityOfDefault
      const lgd = exposure.lossGivenDefault
      const ead = exposure.exposure

      // Variance of individual exposure
      const exposureVariance = Math.pow(ead * lgd, 2) * pd * (1 - pd)
      variance += exposureVariance
    }

    // Add correlation effects (simplified)
    const correlationAdjustment = 1.2 // 20% correlation adjustment

    return Math.sqrt(variance) * correlationAdjustment
  }

  /**
   * Calculate weighted average credit rating
   */
  private calculateAverageCreditRating(exposures: CounterpartyExposure[]): string {
    const totalExposure = exposures.reduce((sum, exp) => sum + exp.exposure, 0)
    let weightedPD = 0

    for (const exposure of exposures) {
      const weight = exposure.exposure / totalExposure
      weightedPD += weight * exposure.probabilityOfDefault
    }

    // Map back to rating
    return this.probabilityToRating(weightedPD)
  }

  /**
   * Calculate concentration risk using Herfindahl index
   */
  private calculateConcentrationRisk(exposures: CounterpartyExposure[], totalExposure: number): number {
    let hhi = 0

    for (const exposure of exposures) {
      const weight = exposure.exposure / totalExposure
      hhi += Math.pow(weight, 2)
    }

    return hhi
  }

  /**
   * Get credit rating for counterparty
   */
  private getCreditRating(counterparty: string): CreditRating {
    // Simplified mapping - would use actual credit ratings
    const defaultRating = this.creditRatings.get("BBB") || {
      rating: "BBB",
      probabilityOfDefault: 0.002,
      lossGivenDefault: 0.45,
      riskWeight: 1.0,
    }

    // Map sectors to typical credit ratings
    const sectorRatings: Record<string, string> = {
      Technology: "A",
      Healthcare: "A-",
      Financials: "BBB+",
      Energy: "BBB",
      Utilities: "A+",
      Consumer: "BBB+",
      Industrial: "BBB",
      Materials: "BBB-",
      "Real Estate": "BBB-",
      Unknown: "BBB",
    }

    const rating = sectorRatings[counterparty] || "BBB"
    return this.creditRatings.get(rating) || defaultRating
  }

  /**
   * Map probability of default back to rating
   */
  private probabilityToRating(pd: number): string {
    if (pd <= 0.0001) return "AAA"
    if (pd <= 0.0003) return "AA+"
    if (pd <= 0.0005) return "AA"
    if (pd <= 0.0008) return "AA-"
    if (pd <= 0.0012) return "A+"
    if (pd <= 0.0018) return "A"
    if (pd <= 0.0025) return "A-"
    if (pd <= 0.0035) return "BBB+"
    if (pd <= 0.005) return "BBB"
    if (pd <= 0.008) return "BBB-"
    if (pd <= 0.015) return "BB+"
    if (pd <= 0.025) return "BB"
    if (pd <= 0.04) return "BB-"
    if (pd <= 0.07) return "B+"
    if (pd <= 0.12) return "B"
    if (pd <= 0.2) return "B-"
    return "CCC"
  }

  /**
   * Initialize credit rating parameters
   */
  private initializeCreditRatings(): void {
    const ratings: CreditRating[] = [
      { rating: "AAA", probabilityOfDefault: 0.0001, lossGivenDefault: 0.4, riskWeight: 0.0 },
      { rating: "AA+", probabilityOfDefault: 0.0003, lossGivenDefault: 0.4, riskWeight: 0.2 },
      { rating: "AA", probabilityOfDefault: 0.0005, lossGivenDefault: 0.4, riskWeight: 0.2 },
      { rating: "AA-", probabilityOfDefault: 0.0008, lossGivenDefault: 0.4, riskWeight: 0.2 },
      { rating: "A+", probabilityOfDefault: 0.0012, lossGivenDefault: 0.42, riskWeight: 0.5 },
      { rating: "A", probabilityOfDefault: 0.0018, lossGivenDefault: 0.42, riskWeight: 0.5 },
      { rating: "A-", probabilityOfDefault: 0.0025, lossGivenDefault: 0.42, riskWeight: 0.5 },
      { rating: "BBB+", probabilityOfDefault: 0.0035, lossGivenDefault: 0.45, riskWeight: 1.0 },
      { rating: "BBB", probabilityOfDefault: 0.005, lossGivenDefault: 0.45, riskWeight: 1.0 },
      { rating: "BBB-", probabilityOfDefault: 0.008, lossGivenDefault: 0.45, riskWeight: 1.0 },
      { rating: "BB+", probabilityOfDefault: 0.015, lossGivenDefault: 0.5, riskWeight: 1.5 },
      { rating: "BB", probabilityOfDefault: 0.025, lossGivenDefault: 0.5, riskWeight: 1.5 },
      { rating: "BB-", probabilityOfDefault: 0.04, lossGivenDefault: 0.5, riskWeight: 1.5 },
      { rating: "B+", probabilityOfDefault: 0.07, lossGivenDefault: 0.55, riskWeight: 2.5 },
      { rating: "B", probabilityOfDefault: 0.12, lossGivenDefault: 0.55, riskWeight: 2.5 },
      { rating: "B-", probabilityOfDefault: 0.2, lossGivenDefault: 0.55, riskWeight: 2.5 },
      { rating: "CCC", probabilityOfDefault: 0.35, lossGivenDefault: 0.65, riskWeight: 10.0 },
    ]

    for (const rating of ratings) {
      this.creditRatings.set(rating.rating, rating)
    }
  }
}
