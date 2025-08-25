// Regulatory stress testing compliance (Basel III, CCAR, etc.)

import type { Portfolio } from "../types/risk"
import { ScenarioEngine } from "./scenario-engine"

export interface RegulatoryStressTest {
  id: string
  name: string
  regulation: "basel_iii" | "ccar" | "ifrs9" | "solvency_ii"
  description: string
  scenarios: RegulatoryScenario[]
  requirements: RegulatoryRequirement[]
}

export interface RegulatoryScenario {
  id: string
  name: string
  description: string
  severity: "baseline" | "adverse" | "severely_adverse"
  timeHorizon: number // quarters
  macroVariables: MacroVariable[]
}

export interface MacroVariable {
  variable: string
  baselineValue: number
  adverseValue: number
  severelyAdverseValue: number
  unit: string
}

export interface RegulatoryRequirement {
  metric: string
  threshold: number
  operator: ">" | "<" | ">=" | "<="
  description: string
}

export interface RegulatoryStressResult {
  testId: string
  portfolioId: string
  scenarioResults: ScenarioResult[]
  complianceStatus: "pass" | "fail" | "warning"
  failedRequirements: string[]
  capitalAdequacy: CapitalAdequacyResult
  executedAt: Date
}

export interface ScenarioResult {
  scenarioId: string
  severity: string
  portfolioValue: number
  capitalRatio: number
  leverageRatio: number
  liquidityCoverageRatio: number
  riskWeightedAssets: number
}

export interface CapitalAdequacyResult {
  tier1Capital: number
  tier1Ratio: number
  totalCapitalRatio: number
  leverageRatio: number
  minimumRequirements: {
    tier1Ratio: number
    totalCapitalRatio: number
    leverageRatio: number
  }
  bufferRequirements: {
    conservationBuffer: number
    countercyclicalBuffer: number
    systemicBuffer: number
  }
}

export class RegulatoryStressTester {
  private scenarioEngine: ScenarioEngine
  private regulatoryTests: Map<string, RegulatoryStressTest> = new Map()

  constructor() {
    this.scenarioEngine = new ScenarioEngine()
    this.initializeRegulatoryTests()
  }

  /**
   * Run regulatory stress test
   */
  public async runRegulatoryStressTest(portfolio: Portfolio, testId: string): Promise<RegulatoryStressResult> {
    const test = this.regulatoryTests.get(testId)
    if (!test) {
      throw new Error(`Regulatory test ${testId} not found`)
    }

    const scenarioResults: ScenarioResult[] = []

    // Run each scenario
    for (const scenario of test.scenarios) {
      const result = await this.runRegulatoryScenario(portfolio, scenario)
      scenarioResults.push(result)
    }

    // Check compliance
    const complianceStatus = this.checkCompliance(scenarioResults, test.requirements)
    const failedRequirements = this.getFailedRequirements(scenarioResults, test.requirements)

    // Calculate capital adequacy
    const capitalAdequacy = this.calculateCapitalAdequacy(portfolio, scenarioResults)

    return {
      testId,
      portfolioId: portfolio.id,
      scenarioResults,
      complianceStatus,
      failedRequirements,
      capitalAdequacy,
      executedAt: new Date(),
    }
  }

  /**
   * Run individual regulatory scenario
   */
  private async runRegulatoryScenario(portfolio: Portfolio, scenario: RegulatoryScenario): Promise<ScenarioResult> {
    // Convert macro variables to market shocks
    const marketShocks = this.convertMacroVariablesToShocks(scenario.macroVariables, scenario.severity)

    // Create stress test scenario
    const stressScenario = {
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      type: "custom" as const,
      parameters: {
        regulation: true,
        timeHorizon: scenario.timeHorizon,
      },
      shocks: marketShocks,
    }

    // Execute stress test
    const stressResult = await this.scenarioEngine["executeStressTest"](portfolio, stressScenario)

    // Calculate regulatory metrics
    const riskWeightedAssets = this.calculateRiskWeightedAssets(portfolio)
    const tier1Capital = portfolio.totalValue * 0.12 // Simplified assumption
    const capitalRatio = tier1Capital / riskWeightedAssets
    const leverageRatio = tier1Capital / portfolio.totalValue
    const liquidityCoverageRatio = this.calculateLCR(portfolio)

    return {
      scenarioId: scenario.id,
      severity: scenario.severity,
      portfolioValue: stressResult.portfolioValue,
      capitalRatio,
      leverageRatio,
      liquidityCoverageRatio,
      riskWeightedAssets,
    }
  }

  /**
   * Check compliance with regulatory requirements
   */
  private checkCompliance(
    results: ScenarioResult[],
    requirements: RegulatoryRequirement[],
  ): "pass" | "fail" | "warning" {
    let hasFailures = false
    let hasWarnings = false

    for (const requirement of requirements) {
      for (const result of results) {
        const value = this.getMetricValue(result, requirement.metric)
        const passes = this.evaluateRequirement(value, requirement.threshold, requirement.operator)

        if (!passes) {
          if (requirement.metric.includes("minimum")) {
            hasFailures = true
          } else {
            hasWarnings = true
          }
        }
      }
    }

    if (hasFailures) return "fail"
    if (hasWarnings) return "warning"
    return "pass"
  }

  /**
   * Get failed requirements
   */
  private getFailedRequirements(results: ScenarioResult[], requirements: RegulatoryRequirement[]): string[] {
    const failed: string[] = []

    for (const requirement of requirements) {
      for (const result of results) {
        const value = this.getMetricValue(result, requirement.metric)
        const passes = this.evaluateRequirement(value, requirement.threshold, requirement.operator)

        if (!passes) {
          failed.push(`${requirement.metric} (${value.toFixed(2)}% vs ${requirement.threshold}% required)`)
        }
      }
    }

    return failed
  }

  /**
   * Calculate capital adequacy metrics
   */
  private calculateCapitalAdequacy(portfolio: Portfolio, results: ScenarioResult[]): CapitalAdequacyResult {
    const tier1Capital = portfolio.totalValue * 0.12 // Simplified
    const riskWeightedAssets = this.calculateRiskWeightedAssets(portfolio)

    const tier1Ratio = (tier1Capital / riskWeightedAssets) * 100
    const totalCapitalRatio = ((tier1Capital * 1.2) / riskWeightedAssets) * 100 // Including Tier 2
    const leverageRatio = (tier1Capital / portfolio.totalValue) * 100

    return {
      tier1Capital,
      tier1Ratio,
      totalCapitalRatio,
      leverageRatio,
      minimumRequirements: {
        tier1Ratio: 6.0, // Basel III minimum
        totalCapitalRatio: 8.0,
        leverageRatio: 3.0,
      },
      bufferRequirements: {
        conservationBuffer: 2.5,
        countercyclicalBuffer: 0.0, // Varies by jurisdiction
        systemicBuffer: 1.0, // For systemically important institutions
      },
    }
  }

  // Helper methods
  private convertMacroVariablesToShocks(variables: MacroVariable[], severity: string): any[] {
    const shocks = []

    for (const variable of variables) {
      let shockValue: number

      switch (severity) {
        case "baseline":
          shockValue = 0 // No shock in baseline
          break
        case "adverse":
          shockValue = (variable.adverseValue - variable.baselineValue) / variable.baselineValue
          break
        case "severely_adverse":
          shockValue = (variable.severelyAdverseValue - variable.baselineValue) / variable.baselineValue
          break
        default:
          shockValue = 0
      }

      // Map macro variables to asset classes
      if (variable.variable.includes("gdp")) {
        shocks.push({ assetClass: "equity", shockType: "relative", value: shockValue * 3 })
      } else if (variable.variable.includes("unemployment")) {
        shocks.push({ assetClass: "equity", shockType: "relative", value: -shockValue * 2 })
      } else if (variable.variable.includes("interest")) {
        shocks.push({ assetClass: "bond_etf", shockType: "relative", value: -shockValue * 5 })
        shocks.push({ assetClass: "Financials", shockType: "relative", value: shockValue * 2 })
      }
    }

    return shocks
  }

  private calculateRiskWeightedAssets(portfolio: Portfolio): number {
    let rwa = 0

    for (const position of portfolio.positions) {
      const riskWeight = this.getRiskWeight(position)
      rwa += position.marketValue * riskWeight
    }

    return rwa
  }

  private getRiskWeight(position: any): number {
    // Simplified risk weights based on asset type
    const assetClass = position.sector || "equity"

    const riskWeights: Record<string, number> = {
      Government: 0.0, // Government bonds
      "AAA Corporate": 0.2,
      "Investment Grade": 0.5,
      equity: 1.0,
      "High Yield": 1.5,
      "Real Estate": 1.0,
      commodity: 1.0,
    }

    return riskWeights[assetClass] || 1.0
  }

  private calculateLCR(portfolio: Portfolio): number {
    // Simplified Liquidity Coverage Ratio calculation
    const highQualityLiquidAssets = portfolio.totalValue * 0.1 // Assume 10% in HQLA
    const netCashOutflows = portfolio.totalValue * 0.05 // Assume 5% net outflows

    return (highQualityLiquidAssets / netCashOutflows) * 100
  }

  private getMetricValue(result: ScenarioResult, metric: string): number {
    switch (metric) {
      case "capitalRatio":
        return result.capitalRatio * 100
      case "leverageRatio":
        return result.leverageRatio * 100
      case "liquidityCoverageRatio":
        return result.liquidityCoverageRatio
      default:
        return 0
    }
  }

  private evaluateRequirement(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case ">":
        return value > threshold
      case "<":
        return value < threshold
      case ">=":
        return value >= threshold
      case "<=":
        return value <= threshold
      default:
        return false
    }
  }

  /**
   * Initialize regulatory stress tests
   */
  private initializeRegulatoryTests(): void {
    // Basel III Stress Test
    this.regulatoryTests.set("basel_iii", {
      id: "basel_iii",
      name: "Basel III Stress Test",
      regulation: "basel_iii",
      description: "Basel III capital adequacy stress testing",
      scenarios: [
        {
          id: "basel_baseline",
          name: "Basel Baseline Scenario",
          description: "Baseline economic scenario",
          severity: "baseline",
          timeHorizon: 9, // 9 quarters
          macroVariables: [
            {
              variable: "real_gdp_growth",
              baselineValue: 2.5,
              adverseValue: 0.5,
              severelyAdverseValue: -3.0,
              unit: "percent",
            },
            {
              variable: "unemployment_rate",
              baselineValue: 4.0,
              adverseValue: 6.5,
              severelyAdverseValue: 10.0,
              unit: "percent",
            },
            {
              variable: "10y_treasury_rate",
              baselineValue: 2.5,
              adverseValue: 1.0,
              severelyAdverseValue: 0.5,
              unit: "percent",
            },
          ],
        },
        {
          id: "basel_adverse",
          name: "Basel Adverse Scenario",
          description: "Adverse economic scenario",
          severity: "adverse",
          timeHorizon: 9,
          macroVariables: [
            {
              variable: "real_gdp_growth",
              baselineValue: 2.5,
              adverseValue: 0.5,
              severelyAdverseValue: -3.0,
              unit: "percent",
            },
          ],
        },
        {
          id: "basel_severely_adverse",
          name: "Basel Severely Adverse Scenario",
          description: "Severely adverse economic scenario",
          severity: "severely_adverse",
          timeHorizon: 9,
          macroVariables: [
            {
              variable: "real_gdp_growth",
              baselineValue: 2.5,
              adverseValue: 0.5,
              severelyAdverseValue: -3.0,
              unit: "percent",
            },
          ],
        },
      ],
      requirements: [
        {
          metric: "capitalRatio",
          threshold: 6.0,
          operator: ">=",
          description: "Minimum Tier 1 capital ratio",
        },
        {
          metric: "leverageRatio",
          threshold: 3.0,
          operator: ">=",
          description: "Minimum leverage ratio",
        },
        {
          metric: "liquidityCoverageRatio",
          threshold: 100.0,
          operator: ">=",
          description: "Minimum liquidity coverage ratio",
        },
      ],
    })

    // CCAR Stress Test (US Federal Reserve)
    this.regulatoryTests.set("ccar", {
      id: "ccar",
      name: "CCAR Stress Test",
      regulation: "ccar",
      description: "Comprehensive Capital Analysis and Review",
      scenarios: [
        {
          id: "ccar_baseline",
          name: "CCAR Baseline",
          description: "Federal Reserve baseline scenario",
          severity: "baseline",
          timeHorizon: 9,
          macroVariables: [
            {
              variable: "real_gdp_growth",
              baselineValue: 2.0,
              adverseValue: -1.0,
              severelyAdverseValue: -4.0,
              unit: "percent",
            },
          ],
        },
      ],
      requirements: [
        {
          metric: "capitalRatio",
          threshold: 4.5,
          operator: ">=",
          description: "Minimum Common Equity Tier 1 ratio",
        },
      ],
    })
  }
}
