module.exports = {
  monitoring: {
    interval: "*/1 * * * *", // Check every minute
    batchSize: 100,
    maxRetries: 3,
  },
  notifications: {
    email: {
      from: process.env.FROM_EMAIL || "alerts@yourapp.com",
      retryDelay: 5000,
    },
    websocket: {
      heartbeatInterval: 30000,
    },
  },
  api: {
    priceProvider: "coingecko",
    cacheTtl: 30000, // 30 seconds
    requestTimeout: 10000,
  },
};
