// Stress testing scenario engine and management

import type { Portfolio, StressTestScenario, StressTestResult, MarketShock } from "../types/risk"
import { MarketDataService } from "../services/market-data-service"

export interface HistoricalScenario {
  id: string
  name: string
  description: string
  startDate: Date
  endDate: Date
  marketShocks: MarketShock[]
  severity: "mild" | "moderate" | "severe" | "extreme"
}

export interface MonteCarloParameters {
  simulations: number
  timeHorizon: number // days
  confidenceLevel: number
  correlationDecay: number
  volatilityScaling: number
}

export interface CustomScenario {
  id: string
  name: string
  description: string
  shocks: MarketShock[]
  macroeconomicFactors: MacroFactor[]
}

export interface MacroFactor {
  factor: "interest_rates" | "inflation" | "gdp_growth" | "unemployment" | "oil_price" | "currency"
  shock: number // percentage change
  propagationModel: "linear" | "exponential" | "logarithmic"
}

export class ScenarioEngine {
  private marketDataService: MarketDataService
  private historicalScenarios: Map<string, HistoricalScenario> = new Map()
  private customScenarios: Map<string, CustomScenario> = new Map()

  constructor() {
    this.marketDataService = MarketDataService.getInstance()
    this.initializeHistoricalScenarios()
  }

  /**
   * Run historical scenario stress test
   */
  public async runHistoricalStressTest(portfolio: Portfolio, scenarioId: string): Promise<StressTestResult> {
    const scenario = this.historicalScenarios.get(scenarioId)
    if (!scenario) {
      throw new Error(`Historical scenario ${scenarioId} not found`)
    }

    return this.executeStressTest(portfolio, {
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      type: "historical",
      parameters: {
        startDate: scenario.startDate,
        endDate: scenario.endDate,
        severity: scenario.severity,
      },
      shocks: scenario.marketShocks,
    })
  }

  /**
   * Run Monte Carlo stress test
   */
  public async runMonteCarloStressTest(
    portfolio: Portfolio,
    parameters: MonteCarloParameters,
  ): Promise<StressTestResult[]> {
    const results: StressTestResult[] = []

    for (let i = 0; i < parameters.simulations; i++) {
      const scenario = this.generateMonteCarloScenario(portfolio, parameters, i)
      const result = await this.executeStressTest(portfolio, scenario)
      results.push(result)
    }

    return results
  }

  /**
   * Run custom scenario stress test
   */
  public async runCustomStressTest(portfolio: Portfolio, scenarioId: string): Promise<StressTestResult> {
    const customScenario = this.customScenarios.get(scenarioId)
    if (!customScenario) {
      throw new Error(`Custom scenario ${scenarioId} not found`)
    }

    // Convert macro factors to market shocks
    const marketShocks = this.convertMacroFactorsToShocks(customScenario.macroeconomicFactors)
    const allShocks = [...customScenario.shocks, ...marketShocks]

    return this.executeStressTest(portfolio, {
      id: customScenario.id,
      name: customScenario.name,
      description: customScenario.description,
      type: "custom",
      parameters: {
        macroFactors: customScenario.macroeconomicFactors,
      },
      shocks: allShocks,
    })
  }

  /**
   * Execute stress test scenario
   */
  private async executeStressTest(portfolio: Portfolio, scenario: StressTestScenario): Promise<StressTestResult> {
    let totalPnL = 0
    const stressedPositions = []
    const worstPositions = []

    for (const position of portfolio.positions) {
      const positionShock = this.findApplicableShock(position, scenario.shocks)
      let stressedValue = position.marketValue

      if (positionShock) {
        if (positionShock.shockType === "relative") {
          stressedValue = position.marketValue * (1 + positionShock.value)
        } else {
          stressedValue = position.marketValue + positionShock.value
        }
      }

      const positionPnL = stressedValue - position.marketValue
      totalPnL += positionPnL

      const stressedPosition = {
        ...position,
        stressedValue,
        pnl: positionPnL,
        pnlPercent: (positionPnL / position.marketValue) * 100,
      }

      stressedPositions.push(stressedPosition)

      // Track worst performing positions
      if (positionPnL < 0) {
        worstPositions.push(stressedPosition)
      }
    }

    // Sort worst positions by loss
    worstPositions.sort((a, b) => a.pnl - b.pnl)

    const portfolioValue = portfolio.totalValue + totalPnL
    const pnlPercent = (totalPnL / portfolio.totalValue) * 100

    return {
      scenarioId: scenario.id,
      portfolioId: portfolio.id,
      portfolioValue,
      pnl: totalPnL,
      pnlPercent,
      worstPositions: worstPositions.slice(0, 10), // Top 10 worst positions
      riskMetrics: {
        var95: Math.abs(totalPnL) * 1.1, // Simplified stress VaR
        volatility: Math.abs(pnlPercent) * 0.5,
        maxDrawdown: Math.abs(pnlPercent),
      },
      executedAt: new Date(),
    }
  }

  /**
   * Generate Monte Carlo scenario
   */
  private generateMonteCarloScenario(
    portfolio: Portfolio,
    parameters: MonteCarloParameters,
    simulationIndex: number,
  ): StressTestScenario {
    const shocks: MarketShock[] = []

    // Get unique asset classes from portfolio
    const assetClasses = new Set(portfolio.positions.map((p) => this.getAssetClass(p.symbol)))

    for (const assetClass of assetClasses) {
      // Generate random shock based on historical volatility
      const historicalVolatility = this.getHistoricalVolatility(assetClass)
      const scaledVolatility = historicalVolatility * parameters.volatilityScaling

      // Generate shock using normal distribution
      const randomShock = this.generateNormalRandom(0, scaledVolatility)

      // Scale by time horizon
      const timeScaledShock = randomShock * Math.sqrt(parameters.timeHorizon / 252)

      shocks.push({
        assetClass,
        shockType: "relative",
        value: timeScaledShock,
      })
    }

    return {
      id: `monte_carlo_${simulationIndex}`,
      name: `Monte Carlo Simulation ${simulationIndex + 1}`,
      description: `Generated Monte Carlo scenario with ${parameters.simulations} simulations`,
      type: "monte_carlo",
      parameters: {
        simulation: simulationIndex,
        timeHorizon: parameters.timeHorizon,
        confidenceLevel: parameters.confidenceLevel,
      },
      shocks,
    }
  }

  /**
   * Create custom scenario
   */
  public createCustomScenario(scenario: CustomScenario): void {
    this.customScenarios.set(scenario.id, scenario)
  }

  /**
   * Get all available scenarios
   */
  public getAvailableScenarios(): {
    historical: HistoricalScenario[]
    custom: CustomScenario[]
  } {
    return {
      historical: Array.from(this.historicalScenarios.values()),
      custom: Array.from(this.customScenarios.values()),
    }
  }

  // Helper methods
  private findApplicableShock(position: any, shocks: MarketShock[]): MarketShock | null {
    // First try to find symbol-specific shock
    const symbolShock = shocks.find((shock) => shock.symbol === position.symbol)
    if (symbolShock) return symbolShock

    // Then try asset class shock
    const assetClass = this.getAssetClass(position.symbol)
    const assetClassShock = shocks.find((shock) => shock.assetClass === assetClass)
    if (assetClassShock) return assetClassShock

    // Finally try sector shock
    const sectorShock = shocks.find((shock) => shock.assetClass === position.sector)
    if (sectorShock) return sectorShock

    return null
  }

  private getAssetClass(symbol: string): string {
    // Simplified asset class mapping
    if (symbol.includes("SPY") || symbol.includes("QQQ") || symbol.includes("VTI")) {
      return "equity_etf"
    }
    if (symbol.includes("TLT") || symbol.includes("IEF")) {
      return "bond_etf"
    }
    if (symbol.includes("GLD") || symbol.includes("SLV")) {
      return "commodity"
    }
    return "equity"
  }

  private getHistoricalVolatility(assetClass: string): number {
    // Historical volatilities by asset class
    const volatilities: Record<string, number> = {
      equity: 0.2, // 20% annual volatility
      equity_etf: 0.18,
      bond_etf: 0.05,
      commodity: 0.25,
      currency: 0.12,
      real_estate: 0.22,
    }

    return volatilities[assetClass] || 0.2
  }

  private generateNormalRandom(mean: number, stdDev: number): number {
    // Box-Muller transformation
    const u1 = Math.random()
    const u2 = Math.random()
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    return mean + stdDev * z0
  }

  private convertMacroFactorsToShocks(macroFactors: MacroFactor[]): MarketShock[] {
    const shocks: MarketShock[] = []

    for (const factor of macroFactors) {
      switch (factor.factor) {
        case "interest_rates":
          // Interest rate changes affect bonds and financials
          shocks.push({
            assetClass: "bond_etf",
            shockType: "relative",
            value: -factor.shock * 5, // Duration effect
          })
          shocks.push({
            assetClass: "Financials",
            shockType: "relative",
            value: factor.shock * 2, // Banks benefit from higher rates
          })
          break

        case "oil_price":
          shocks.push({
            assetClass: "Energy",
            shockType: "relative",
            value: factor.shock * 1.5,
          })
          break

        case "gdp_growth":
          shocks.push({
            assetClass: "equity",
            shockType: "relative",
            value: factor.shock * 3,
          })
          break

        case "inflation":
          shocks.push({
            assetClass: "commodity",
            shockType: "relative",
            value: factor.shock * 2,
          })
          shocks.push({
            assetClass: "bond_etf",
            shockType: "relative",
            value: -factor.shock * 3,
          })
          break
      }
    }

    return shocks
  }

  /**
   * Initialize predefined historical scenarios
   */
  private initializeHistoricalScenarios(): void {
    // 2008 Financial Crisis
    this.historicalScenarios.set("financial_crisis_2008", {
      id: "financial_crisis_2008",
      name: "2008 Financial Crisis",
      description: "Global financial crisis triggered by subprime mortgage collapse",
      startDate: new Date("2008-09-01"),
      endDate: new Date("2009-03-01"),
      severity: "extreme",
      marketShocks: [
        { assetClass: "equity", shockType: "relative", value: -0.45 },
        { assetClass: "Financials", shockType: "relative", value: -0.65 },
        { assetClass: "Real Estate", shockType: "relative", value: -0.35 },
        { assetClass: "commodity", shockType: "relative", value: -0.25 },
        { assetClass: "bond_etf", shockType: "relative", value: 0.15 },
      ],
    })

    // COVID-19 Pandemic
    this.historicalScenarios.set("covid_2020", {
      id: "covid_2020",
      name: "COVID-19 Pandemic",
      description: "Market crash due to global pandemic and lockdowns",
      startDate: new Date("2020-02-01"),
      endDate: new Date("2020-04-01"),
      severity: "severe",
      marketShocks: [
        { assetClass: "equity", shockType: "relative", value: -0.35 },
        { assetClass: "Energy", shockType: "relative", value: -0.55 },
        { assetClass: "Travel", shockType: "relative", value: -0.7 },
        { assetClass: "Technology", shockType: "relative", value: -0.15 },
        { assetClass: "Healthcare", shockType: "relative", value: 0.05 },
      ],
    })

    // Dot-com Bubble
    this.historicalScenarios.set("dotcom_2000", {
      id: "dotcom_2000",
      name: "Dot-com Bubble Burst",
      description: "Technology stock crash following internet bubble",
      startDate: new Date("2000-03-01"),
      endDate: new Date("2002-10-01"),
      severity: "severe",
      marketShocks: [
        { assetClass: "Technology", shockType: "relative", value: -0.75 },
        { assetClass: "equity", shockType: "relative", value: -0.45 },
        { assetClass: "bond_etf", shockType: "relative", value: 0.2 },
      ],
    })

    // European Debt Crisis
    this.historicalScenarios.set("european_debt_2011", {
      id: "european_debt_2011",
      name: "European Debt Crisis",
      description: "Sovereign debt crisis in European countries",
      startDate: new Date("2011-05-01"),
      endDate: new Date("2012-06-01"),
      severity: "moderate",
      marketShocks: [
        { assetClass: "equity", shockType: "relative", value: -0.25 },
        { assetClass: "Financials", shockType: "relative", value: -0.4 },
        { assetClass: "currency", shockType: "relative", value: -0.15 },
      ],
    })

    // Flash Crash 2010
    this.historicalScenarios.set("flash_crash_2010", {
      id: "flash_crash_2010",
      name: "Flash Crash 2010",
      description: "Rapid market decline due to algorithmic trading",
      startDate: new Date("2010-05-06"),
      endDate: new Date("2010-05-06"),
      severity: "mild",
      marketShocks: [
        { assetClass: "equity", shockType: "relative", value: -0.1 },
        { assetClass: "equity_etf", shockType: "relative", value: -0.12 },
      ],
    })
  }
}
