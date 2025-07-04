const axios = require("axios");

class PriceService {
  constructor() {
    this.priceCache = new Map();
    this.cacheExpiry = 30 * 1000; // 30 seconds
    this.apiUrl = "https://api.coingecko.com/api/v3";
  }

  async getCurrentPrice(symbol) {
    const cacheKey = symbol.toLowerCase();
    const cached = this.priceCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    try {
      const response = await axios.get(
        `${
          this.apiUrl
        }/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd&include_24hr_change=true`
      );

      const data = response.data[symbol.toLowerCase()];
      if (!data) {
        throw new Error(`Price data not found for ${symbol}`);
      }

      const priceData = {
        price: data.usd,
        change24h: data.usd_24h_change || 0,
        timestamp: Date.now(),
      };

      this.priceCache.set(cacheKey, {
        data: priceData,
        timestamp: Date.now(),
      });

      return priceData;
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error.message);
      throw new Error(`Failed to fetch price for ${symbol}`);
    }
  }

  async getHistoricalPrice(symbol, hoursAgo) {
    try {
      const response = await axios.get(
        `${this.apiUrl}/coins/${symbol.toLowerCase()}/market_chart`,
        {
          params: {
            vs_currency: "usd",
            days: Math.ceil(hoursAgo / 24) || 1,
          },
        }
      );

      const prices = response.data.prices;
      if (!prices || prices.length === 0) {
        throw new Error(`No historical data for ${symbol}`);
      }

      // Find price closest to the requested time
      const targetTime = Date.now() - hoursAgo * 60 * 60 * 1000;
      const closestPrice = prices.reduce((prev, curr) => {
        return Math.abs(curr[0] - targetTime) < Math.abs(prev[0] - targetTime)
          ? curr
          : prev;
      });

      return closestPrice[1];
    } catch (error) {
      console.error(
        `Error fetching historical price for ${symbol}:`,
        error.message
      );
      throw error;
    }
  }

  calculatePercentageChange(currentPrice, oldPrice) {
    return ((currentPrice - oldPrice) / oldPrice) * 100;
  }
}

module.exports = new PriceService();
