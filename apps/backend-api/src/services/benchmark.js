export class BenchmarkService {
  private benchmarks: Record<string, string> = {
    SPY: "S&P 500",
    QQQ: "NASDAQ 100",
    VTI: "Total Stock Market",
    BND: "Total Bond Market",
  }

  async getBenchmarkData(symbol: string, timeframe: string): Promise<number[]> {
    const days = this.getTimeframeDays(timeframe)

    // Mock benchmark data generation
    const data: number[] = []
    let value = 100 // Start at 100

    for (let i = 0; i < days; i++) {
      // Benchmarks typically have lower volatility
      value *= 1 + (Math.random() - 0.5) * 0.015
      data.push(value)
    }

    return data
  }

  async getBenchmarkMetrics(symbol: string): Promise<any> {
    return {
      symbol,
      name: this.benchmarks[symbol] || "Unknown Benchmark",
      ytdReturn: (Math.random() - 0.5) * 20,
      volatility: Math.random() * 0.2,
      sharpeRatio: Math.random() * 2,
      maxDrawdown: Math.random() * 0.3,
    }
  }

  private getTimeframeDays(timeframe: string): number {
    switch (timeframe) {
      case "1M":
        return 30
      case "3M":
        return 90
      case "6M":
        return 180
      case "1Y":
        return 365
      case "2Y":
        return 730
      case "5Y":
        return 1825
      default:
        return 365
    }
  }
}
