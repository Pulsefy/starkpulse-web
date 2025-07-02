class NotificationService {
  constructor(wsService) {
    this.wsService = wsService
    this.newsSubscriptions = new Map() // socketId -> Set of categories
    this.alertSubscriptions = new Set() // Set of socketIds
    this.newsInterval = null
    this.alertInterval = null
  }

  start() {
    // Simulate news updates
    this.newsInterval = setInterval(() => {
      this.generateNewsUpdates()
    }, 30000) // Every 30 seconds

    // Simulate system alerts
    this.alertInterval = setInterval(() => {
      this.generateSystemAlerts()
    }, 60000) // Every minute

    console.log("Notification Service started")
  }

  stop() {
    if (this.newsInterval) {
      clearInterval(this.newsInterval)
    }
    if (this.alertInterval) {
      clearInterval(this.alertInterval)
    }
  }

  subscribeToNews(socket, categories) {
    if (!Array.isArray(categories)) {
      categories = [categories]
    }

    this.newsSubscriptions.set(socket.id, new Set(categories))
    socket.emit("news:subscribed", { categories })
    console.log(`Socket ${socket.id} subscribed to news categories: ${categories.join(", ")}`)
  }

  subscribeToSystemAlerts(socket) {
    this.alertSubscriptions.add(socket.id)
    socket.emit("alerts:subscribed")
    console.log(`Socket ${socket.id} subscribed to system alerts`)
  }

  handleDisconnection(socket) {
    this.newsSubscriptions.delete(socket.id)
    this.alertSubscriptions.delete(socket.id)
  }

  generateNewsUpdates() {
    const newsItems = [
      {
        category: "market",
        title: "Market Update: Tech Stocks Rally",
        content: "Technology stocks are showing strong performance today...",
        priority: "medium",
      },
      {
        category: "earnings",
        title: "Quarterly Earnings Beat Expectations",
        content: "Several major companies reported better than expected earnings...",
        priority: "high",
      },
      {
        category: "crypto",
        title: "Bitcoin Reaches New Monthly High",
        content: "Bitcoin price surged to new monthly highs amid institutional interest...",
        priority: "medium",
      },
    ]

    const randomNews = newsItems[Math.floor(Math.random() * newsItems.length)]

    // Send to subscribers of this news category
    this.newsSubscriptions.forEach((categories, socketId) => {
      if (categories.has(randomNews.category)) {
        const socket = this.wsService.io.sockets.sockets.get(socketId)
        if (socket) {
          socket.emit("news:update", {
            ...randomNews,
            id: Date.now(),
            timestamp: new Date().toISOString(),
          })
        }
      }
    })
  }

  generateSystemAlerts() {
    const alerts = [
      {
        type: "maintenance",
        title: "Scheduled Maintenance",
        message: "System maintenance scheduled for tonight at 2 AM EST",
        severity: "info",
      },
      {
        type: "security",
        title: "Security Update",
        message: "New security features have been enabled for your account",
        severity: "warning",
      },
      {
        type: "performance",
        title: "High Server Load",
        message: "Experiencing higher than normal server load",
        severity: "warning",
      },
    ]

    if (Math.random() < 0.3) {
      // 30% chance of alert
      const randomAlert = alerts[Math.floor(Math.random() * alerts.length)]

      // Send to all alert subscribers
      this.alertSubscriptions.forEach((socketId) => {
        const socket = this.wsService.io.sockets.sockets.get(socketId)
        if (socket) {
          socket.emit("system:alert", {
            ...randomAlert,
            id: Date.now(),
            timestamp: new Date().toISOString(),
          })
        }
      })
    }
  }

  // Send custom notification to specific user
  sendNotificationToUser(userId, notification) {
    this.wsService.broadcastToUser(userId, "notification:custom", notification)
  }

  // Send system-wide announcement
  sendSystemAnnouncement(announcement) {
    this.wsService.broadcastToAll("system:announcement", announcement)
  }
}

module.exports = NotificationService
