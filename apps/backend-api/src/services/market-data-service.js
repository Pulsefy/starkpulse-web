// Market data integration and real-time updates

export interface MarketDataPoint {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  timestamp: Date
}

export interface HistoricalPrice {
  symbol: string
  date: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export class MarketDataService {
  private static instance: MarketDataService
  private currentPrices: Map<string, MarketDataPoint> = new Map()
  private historicalData: Map<string, HistoricalPrice[]> = new Map()
  private subscribers: Map<string, ((data: MarketDataPoint) => void)[]> = new Map()

  private constructor() {
    // Initialize with mock data
    this.initializeMockData()

    // Start real-time price simulation
    this.startPriceSimulation()
  }

  public static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService()
    }
    return MarketDataService.instance
  }

  /**
   * Get current market price for a symbol
   */
  public getCurrentPrice(symbol: string): MarketDataPoint | null {
    return this.currentPrices.get(symbol) || null
  }

  /**
   * Get historical prices for a symbol
   */
  public getHistoricalPrices(symbol: string, days = 252): HistoricalPrice[] {
    const data = this.historicalData.get(symbol) || []
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    return data.filter((price) => price.date >= cutoffDate)
  }

  /**
   * Subscribe to real-time price updates
   */
  public subscribe(symbol: string, callback: (data: MarketDataPoint) => void): void {
    const symbolSubscribers = this.subscribers.get(symbol) || []
    symbolSubscribers.push(callback)
    this.subscribers.set(symbol, symbolSubscribers)
  }

  /**
   * Unsubscribe from price updates
   */
  public unsubscribe(symbol: string, callback: (data: MarketDataPoint) => void): void {
    const symbolSubscribers = this.subscribers.get(symbol) || []
    const index = symbolSubscribers.indexOf(callback)
    if (index > -1) {
      symbolSubscribers.splice(index, 1)
      this.subscribers.set(symbol, symbolSubscribers)
    }
  }

  /**
   * Calculate returns for a symbol over a period
   */
  public calculateReturns(symbol: string, days = 30): number[] {
    const prices = this.getHistoricalPrices(symbol, days)
    const returns: number[] = []

    for (let i = 1; i < prices.length; i++) {
      const prevClose = prices[i - 1].close
      const currentClose = prices[i].close
      returns.push((currentClose - prevClose) / prevClose)
    }

    return returns
  }

  /**
   * Get correlation between two symbols
   */
  public getCorrelation(symbol1: string, symbol2: string, days = 252): number {
    const returns1 = this.calculateReturns(symbol1, days)
    const returns2 = this.calculateReturns(symbol2, days)

    if (returns1.length !== returns2.length || returns1.length < 2) {
      return 0
    }

    const mean1 = returns1.reduce((sum, ret) => sum + ret, 0) / returns1.length
    const mean2 = returns2.reduce((sum, ret) => sum + ret, 0) / returns2.length

    let numerator = 0
    let sumSq1 = 0
    let sumSq2 = 0

    for (let i = 0; i < returns1.length; i++) {
      const diff1 = returns1[i] - mean1
      const diff2 = returns2[i] - mean2
      numerator += diff1 * diff2
      sumSq1 += diff1 * diff1
      sumSq2 += diff2 * diff2
    }

    const denominator = Math.sqrt(sumSq1 * sumSq2)
    return denominator === 0 ? 0 : numerator / denominator
  }

  // Private methods
  private initializeMockData(): void {
    const symbols = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NVDA", "SPY", "QQQ", "VTI"]

    symbols.forEach((symbol) => {
      // Initialize current price
      const basePrice = Math.random() * 200 + 50
      this.currentPrices.set(symbol, {
        symbol,
        price: basePrice,
        change: (Math.random() - 0.5) * 10,
        changePercent: (Math.random() - 0.5) * 5,
        volume: Math.floor(Math.random() * 1000000),
        timestamp: new Date(),
      })

      // Generate historical data
      const historicalPrices: HistoricalPrice[] = []
      let currentPrice = basePrice

      for (let i = 365; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)

        const dailyReturn = (Math.random() - 0.5) * 0.04 // ±2% daily volatility
        const open = currentPrice
        const change = currentPrice * dailyReturn
        const close = currentPrice + change
        const high = Math.max(open, close) * (1 + Math.random() * 0.02)
        const low = Math.min(open, close) * (1 - Math.random() * 0.02)

        historicalPrices.push({
          symbol,
          date,
          open,
          high,
          low,
          close,
          volume: Math.floor(Math.random() * 1000000),
        })

        currentPrice = close
      }

      this.historicalData.set(symbol, historicalPrices)
    })
  }

  private startPriceSimulation(): void {
    setInterval(() => {
      this.currentPrices.forEach((currentData, symbol) => {
        // Simulate price movement
        const volatility = 0.02 // 2% volatility
        const randomChange = (Math.random() - 0.5) * volatility
        const newPrice = currentData.price * (1 + randomChange)
        const change = newPrice - currentData.price
        const changePercent = (change / currentData.price) * 100

        const updatedData: MarketDataPoint = {
          symbol,
          price: newPrice,
          change,
          changePercent,
          volume: Math.floor(Math.random() * 1000000),
          timestamp: new Date(),
        }

        this.currentPrices.set(symbol, updatedData)

        // Notify subscribers
        const subscribers = this.subscribers.get(symbol) || []
        subscribers.forEach((callback) => callback(updatedData))
      })
    }, 5000) // Update every 5 seconds
  }
}
