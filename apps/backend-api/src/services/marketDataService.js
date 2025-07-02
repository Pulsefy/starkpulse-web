class MarketDataService {
  constructor(wsService) {
    this.wsService = wsService
    this.subscriptions = new Map() // socketId -> Set of symbols
    this.symbolSubscribers = new Map() // symbol -> Set of socketIds
    this.marketData = new Map() // symbol -> latest price data
    this.updateInterval = null
  }

  start() {
    // Simulate real-time market data updates
    this.updateInterval = setInterval(() => {
      this.generateMarketUpdates()
    }, 1000) // Update every second

    console.log("Market Data Service started")
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
    }
  }

  subscribeToMarketData(socket, symbols) {
    if (!Array.isArray(symbols)) {
      symbols = [symbols]
    }

    // Initialize socket subscriptions if not exists
    if (!this.subscriptions.has(socket.id)) {
      this.subscriptions.set(socket.id, new Set())
    }

    const socketSubscriptions = this.subscriptions.get(socket.id)

    symbols.forEach((symbol) => {
      // Add to socket subscriptions
      socketSubscriptions.add(symbol)

      // Add to symbol subscribers
      if (!this.symbolSubscribers.has(symbol)) {
        this.symbolSubscribers.set(symbol, new Set())
      }
      this.symbolSubscribers.get(symbol).add(socket.id)

      // Send current price if available
      const currentData = this.marketData.get(symbol)
      if (currentData) {
        socket.emit("market:update", {
          symbol,
          ...currentData,
        })
      }
    })

    socket.emit("market:subscribed", { symbols })
    console.log(`Socket ${socket.id} subscribed to: ${symbols.join(", ")}`)
  }

  unsubscribeFromMarketData(socket, symbols) {
    if (!Array.isArray(symbols)) {
      symbols = [symbols]
    }

    const socketSubscriptions = this.subscriptions.get(socket.id)
    if (!socketSubscriptions) return

    symbols.forEach((symbol) => {
      // Remove from socket subscriptions
      socketSubscriptions.delete(symbol)

      // Remove from symbol subscribers
      const subscribers = this.symbolSubscribers.get(symbol)
      if (subscribers) {
        subscribers.delete(socket.id)
        if (subscribers.size === 0) {
          this.symbolSubscribers.delete(symbol)
        }
      }
    })

    socket.emit("market:unsubscribed", { symbols })
  }

  handleDisconnection(socket) {
    const socketSubscriptions = this.subscriptions.get(socket.id)
    if (socketSubscriptions) {
      // Remove from all symbol subscribers
      socketSubscriptions.forEach((symbol) => {
        const subscribers = this.symbolSubscribers.get(symbol)
        if (subscribers) {
          subscribers.delete(socket.id)
          if (subscribers.size === 0) {
            this.symbolSubscribers.delete(symbol)
          }
        }
      })

      // Remove socket subscriptions
      this.subscriptions.delete(socket.id)
    }
  }

  generateMarketUpdates() {
    const symbols = ["AAPL", "GOOGL", "MSFT", "TSLA", "AMZN", "BTC", "ETH"]

    symbols.forEach((symbol) => {
      const subscribers = this.symbolSubscribers.get(symbol)
      if (!subscribers || subscribers.size === 0) return

      // Generate realistic price movement
      const lastPrice = this.marketData.get(symbol)?.price || this.getBasePrice(symbol)
      const change = (Math.random() - 0.5) * 0.02 // ±1% change
      const newPrice = lastPrice * (1 + change)
      const changePercent = ((newPrice - lastPrice) / lastPrice) * 100

      const marketUpdate = {
        symbol,
        price: Number.parseFloat(newPrice.toFixed(2)),
        change: Number.parseFloat((newPrice - lastPrice).toFixed(2)),
        changePercent: Number.parseFloat(changePercent.toFixed(2)),
        volume: Math.floor(Math.random() * 1000000),
        timestamp: new Date().toISOString(),
      }

      // Store latest data
      this.marketData.set(symbol, marketUpdate)

      // Broadcast to subscribers
      subscribers.forEach((socketId) => {
        const socket = this.wsService.io.sockets.sockets.get(socketId)
        if (socket) {
          socket.emit("market:update", marketUpdate)
        }
      })
    })
  }

  getBasePrice(symbol) {
    const basePrices = {
      AAPL: 150,
      GOOGL: 2500,
      MSFT: 300,
      TSLA: 800,
      AMZN: 3200,
      BTC: 45000,
      ETH: 3000,
    }
    return basePrices[symbol] || 100
  }
}

module.exports = MarketDataService
