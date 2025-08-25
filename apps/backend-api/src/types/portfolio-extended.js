// Extended portfolio types for advanced features

import type { Portfolio, Position } from "./risk"

export interface ExtendedPortfolio extends Portfolio {
  userId: string
  description?: string
  benchmark?: string
  riskProfile: "conservative" | "moderate" | "aggressive"
  targetAllocation?: SectorAllocation[]
  rebalanceFrequency: "daily" | "weekly" | "monthly" | "quarterly"
  autoRebalance: boolean
  createdAt: Date
  tags: string[]
}

export interface SectorAllocation {
  sector: string
  targetWeight: number
  currentWeight: number
  deviation: number
}

export interface ExtendedPosition extends Position {
  costBasis: number
  unrealizedPnL: number
  realizedPnL: number
  dividendYield?: number
  peRatio?: number
  marketCap?: number
  averageDailyVolume?: number
  beta?: number
  riskRating: "low" | "medium" | "high"
  liquidityScore: number
  acquisitionDate: Date
  notes?: string
}

export interface PortfolioSnapshot {
  portfolioId: string
  timestamp: Date
  totalValue: number
  positions: PositionSnapshot[]
  riskMetrics: {
    var95: number
    volatility: number
    sharpeRatio: number
    maxDrawdown: number
  }
}

export interface PositionSnapshot {
  symbol: string
  quantity: number
  price: number
  marketValue: number
  weight: number
}

export interface PortfolioPerformance {
  portfolioId: string
  period: "1d" | "1w" | "1m" | "3m" | "6m" | "1y" | "ytd" | "all"
  totalReturn: number
  totalReturnPercent: number
  annualizedReturn: number
  volatility: number
  sharpeRatio: number
  maxDrawdown: number
  winRate: number
  bestDay: number
  worstDay: number
  benchmarkReturn?: number
  alpha?: number
  beta?: number
  trackingError?: number
  informationRatio?: number
}

export interface RebalanceRecommendation {
  portfolioId: string
  reason: string
  urgency: "low" | "medium" | "high"
  trades: TradeRecommendation[]
  expectedImpact: {
    riskReduction: number
    costEstimate: number
    taxImplications: number
  }
  generatedAt: Date
}

export interface TradeRecommendation {
  symbol: string
  action: "buy" | "sell"
  quantity: number
  currentWeight: number
  targetWeight: number
  rationale: string
}
