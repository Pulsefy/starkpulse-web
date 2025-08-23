// Core risk management types and interfaces

export interface Position {
  id: string
  symbol: string
  quantity: number
  price: number
  marketValue: number
  weight: number
  sector?: string
  currency: string
  lastUpdated: Date
}

export interface Portfolio {
  id: string
  name: string
  positions: Position[]
  totalValue: number
  currency: string
  lastUpdated: Date
}

export interface RiskMetrics {
  portfolioId: string
  var95: number // 95% Value at Risk
  var99: number // 99% Value at Risk
  cvar95: number // 95% Conditional VaR
  cvar99: number // 99% Conditional VaR
  volatility: number
  sharpeRatio: number
  maxDrawdown: number
  beta: number
  correlationRisk: number
  concentrationRisk: number
  liquidityRisk: number
  calculatedAt: Date
}

export interface StressTestScenario {
  id: string
  name: string
  description: string
  type: "historical" | "monte_carlo" | "custom"
  parameters: Record<string, any>
  shocks: MarketShock[]
}

export interface MarketShock {
  assetClass: string
  symbol?: string
  shockType: "absolute" | "relative"
  value: number
}

export interface StressTestResult {
  scenarioId: string
  portfolioId: string
  portfolioValue: number
  pnl: number
  pnlPercent: number
  worstPositions: Position[]
  riskMetrics: Partial<RiskMetrics>
  executedAt: Date
}

export interface RiskLimit {
  id: string
  portfolioId: string
  type: "var" | "concentration" | "sector" | "position" | "leverage"
  threshold: number
  currentValue: number
  status: "ok" | "warning" | "breach"
  lastChecked: Date
}

export interface RiskAlert {
  id: string
  portfolioId: string
  type: "limit_breach" | "concentration" | "liquidity" | "correlation"
  severity: "low" | "medium" | "high" | "critical"
  message: string
  data: Record<string, any>
  acknowledged: boolean
  createdAt: Date
}
