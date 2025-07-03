const axios = require("axios");

class CryptoPriceService {
  constructor() {
    this.priceCache = new Map();
    this.cacheExpiry = 30 * 1000; // 30 seconds cache
    this.apiUrl = "https://api.coingecko.com/api/v3";
  }

  async getPrice(symbol) {
    const cacheKey = symbol.toLowerCase();
    const cached = this.priceCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.price;
    }

    try {
      const response = await axios.get(
        `${this.apiUrl}/simple/price?ids=${cacheKey}&vs_currencies=usd`
      );

      const price = response.data[cacheKey]?.usd;
      if (!price) {
        throw new Error(`Price not available for ${symbol}`);
      }

      this.priceCache.set(cacheKey, {
        price,
        timestamp: Date.now()
      });

      return price;
    } catch (error) {
      console.error(`Failed to fetch price for ${symbol}:`, error.message);
      return 0; // Return 0 as fallback
    }
  }

  async getPriceWithChange(symbol) {
    try {
      const response = await axios.get(
        `${this.apiUrl}/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd&include_24hr_change=true`
      );

      const data = response.data[symbol.toLowerCase()];
      if (!data) {
        throw new Error(`Price data not found for ${symbol}`);
      }

      return {
        price: data.usd,
        change24h: data.usd_24h_change || 0
      };
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error.message);
      return {
        price: 0,
        change24h: 0
      };
    }
  }
}

module.exports = new CryptoPriceService();