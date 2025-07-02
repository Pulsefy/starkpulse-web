class PortfolioService {
  constructor(wsService) {
    this.wsService = wsService
    this.portfolioSubscriptions = new Set() // Set of socketIds
    this.portfolios = new Map() // portfolioId -> portfolio data
    this.updateInterval = null
  }

  start() {
    // Simulate portfolio updates
    this.updateInterval = setInterval(() => {
      this.generatePortfolioUpdates()
    }, 5000) // Update every 5 seconds

    console.log("Portfolio Service started")
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
    }
  }

  subscribeToPortfolioUpdates(socket) {
    this.portfolioSubscriptions.add(socket.id)

    // Send current portfolio data if available
    const portfolioData = this.portfolios.get(socket.portfolioId)
    if (portfolioData) {
      socket.emit("portfolio:update", portfolioData)
    }

    socket.emit("portfolio:subscribed", { portfolioId: socket.portfolioId })
    console.log(`Socket ${socket.id} subscribed to portfolio updates`)
  }

  handleDisconnection(socket) {
    this.portfolioSubscriptions.delete(socket.id)
  }

  generatePortfolioUpdates() {
    // Simulate portfolio changes for active subscriptions
    const activePortfolios = new Set()

    this.portfolioSubscriptions.forEach((socketId) => {
      const socket = this.wsService.io.sockets.sockets.get(socketId)
      if (socket && socket.portfolioId) {
        activePortfolios.add(socket.portfolioId)
      }
    })

    activePortfolios.forEach((portfolioId) => {
      const portfolioUpdate = this.generatePortfolioData(portfolioId)
      this.portfolios.set(portfolioId, portfolioUpdate)

      // Broadcast to portfolio subscribers
      this.wsService.broadcastToPortfolio(portfolioId, "portfolio:update", portfolioUpdate)
    })
  }

  generatePortfolioData(portfolioId) {
    const holdings = [
      { symbol: "AAPL", shares: 100, avgCost: 145 },
      { symbol: "GOOGL", shares: 50, avgCost: 2400 },
      { symbol: "MSFT", shares: 75, avgCost: 290 },
    ]

    let totalValue = 0
    let totalCost = 0

    const positions = holdings.map((holding) => {
      const currentPrice = 145 + (Math.random() - 0.5) * 20 // Simulate price
      const marketValue = holding.shares * currentPrice
      const costBasis = holding.shares * holding.avgCost
      const unrealizedPnL = marketValue - costBasis

      totalValue += marketValue
      totalCost += costBasis

      return {
        ...holding,
        currentPrice: Number.parseFloat(currentPrice.toFixed(2)),
        marketValue: Number.parseFloat(marketValue.toFixed(2)),
        costBasis: Number.parseFloat(costBasis.toFixed(2)),
        unrealizedPnL: Number.parseFloat(unrealizedPnL.toFixed(2)),
        unrealizedPnLPercent: Number.parseFloat(((unrealizedPnL / costBasis) * 100).toFixed(2)),
      }
    })

    const totalUnrealizedPnL = totalValue - totalCost

    return {
      portfolioId,
      totalValue: Number.parseFloat(totalValue.toFixed(2)),
      totalCost: Number.parseFloat(totalCost.toFixed(2)),
      totalUnrealizedPnL: Number.parseFloat(totalUnrealizedPnL.toFixed(2)),
      totalUnrealizedPnLPercent: Number.parseFloat(((totalUnrealizedPnL / totalCost) * 100).toFixed(2)),
      positions,
      lastUpdated: new Date().toISOString(),
    }
  }

  // Manual portfolio update (e.g., after trade execution)
  updatePortfolio(portfolioId, updateData) {
    const currentData = this.portfolios.get(portfolioId) || {}
    const updatedData = { ...currentData, ...updateData, lastUpdated: new Date().toISOString() }

    this.portfolios.set(portfolioId, updatedData)
    this.wsService.broadcastToPortfolio(portfolioId, "portfolio:update", updatedData)
  }
}

module.exports = PortfolioService
