class WebSocketService {
  constructor(io) {
    this.io = io
    this.connections = new Map()
    this.userSockets = new Map()
  }

  handleConnection(socket) {
    // Store connection info
    this.connections.set(socket.id, {
      userId: socket.userId,
      connectedAt: new Date(),
      lastActivity: new Date(),
    })

    // Track user sockets for multi-device support
    if (!this.userSockets.has(socket.userId)) {
      this.userSockets.set(socket.userId, new Set())
    }
    this.userSockets.get(socket.userId).add(socket.id)

    // Send connection confirmation
    socket.emit("connection:confirmed", {
      socketId: socket.id,
      userId: socket.userId,
      timestamp: new Date().toISOString(),
    })

    // Update last activity on any event
    socket.onAny(() => {
      const connection = this.connections.get(socket.id)
      if (connection) {
        connection.lastActivity = new Date()
      }
    })
  }

  handleDisconnection(socket) {
    // Remove from connections
    this.connections.delete(socket.id)

    // Remove from user sockets
    const userSockets = this.userSockets.get(socket.userId)
    if (userSockets) {
      userSockets.delete(socket.id)
      if (userSockets.size === 0) {
        this.userSockets.delete(socket.userId)
      }
    }
  }

  // Broadcast to specific user (all their devices)
  broadcastToUser(userId, event, data) {
    this.io.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    })
  }

  // Broadcast to specific portfolio
  broadcastToPortfolio(portfolioId, event, data) {
    this.io.to(`portfolio:${portfolioId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    })
  }

  // Broadcast to role-based groups
  broadcastToRole(role, event, data) {
    this.io.to(`role:${role}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    })
  }

  // Broadcast to all connected clients
  broadcastToAll(event, data) {
    this.io.emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    })
  }

  // Get connection statistics
  getConnectionStats() {
    return {
      totalConnections: this.connections.size,
      uniqueUsers: this.userSockets.size,
      connections: Array.from(this.connections.entries()).map(([socketId, info]) => ({
        socketId,
        ...info,
      })),
    }
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.userSockets.has(userId)
  }

  // Get user's active sockets
  getUserSockets(userId) {
    return this.userSockets.get(userId) || new Set()
  }
}

module.exports = WebSocketService
