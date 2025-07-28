export class MarketDataService {
  private cache: Map<string, any> = new Map()
  private cacheExpiry: Map<string, number> = new Map()

  async getCurrentPrice(symbol: string): Promise<number> {
    const cacheKey = `price_${symbol}`

    if (this.isValidCache(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    // In a real implementation, this would call an external API
    const price = this.generateMockPrice(symbol)

    this.cache.set(cacheKey, price)
    this.cacheExpiry.set(cacheKey, Date.now() + 60000) // 1 minute cache

    return price
  }

  async getHistoricalPrices(symbol: string, days: number): Promise<number[]> {
    const cacheKey = `historical_${symbol}_${days}`

    if (this.isValidCache(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    const prices = this.generateMockHistoricalPrices(symbol, days)

    this.cache.set(cacheKey, prices)
    this.cacheExpiry.set(cacheKey, Date.now() + 300000) // 5 minute cache

    return prices
  }

  async getMarketData(symbols: string[]): Promise<Record<string, any>> {
    const marketData: Record<string, any> = {}

    for (const symbol of symbols) {
      marketData[symbol] = {
        price: await this.getCurrentPrice(symbol),
        volume: Math.floor(Math.random() * 1000000),
        marketCap: Math.floor(Math.random() * 100000000000),
        beta: Math.random() * 2,
        volatility: Math.random() * 0.5,
      }
    }

    return marketData
  }

  private isValidCache(key: string): boolean {
    const expiry = this.cacheExpiry.get(key)
    return expiry ? Date.now() < expiry : false
  }

  private generateMockPrice(symbol: string): number {
    // Generate consistent mock prices based on symbol
    const hash = this.hashCode(symbol)
    return 50 + (hash % 200) + Math.random() * 10
  }

  private generateMockHistoricalPrices(symbol: string, days: number): number[] {
    const prices: number[] = []
    let currentPrice = this.generateMockPrice(symbol)

    for (let i = 0; i < days; i++) {
      currentPrice *= 1 + (Math.random() - 0.5) * 0.03
      prices.push(currentPrice)
    }

    return prices
  }

  private hashCode(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }
}
