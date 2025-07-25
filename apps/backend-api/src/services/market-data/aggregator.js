// Market Data Aggregator Service
// Integrates with multiple exchanges for real-time data aggregation

const axios = require('axios');

/**
 * Fetch real-time market data from Binance (as an example exchange)
 * @param {string} symbol - e.g., 'BTCUSDT'
 * @returns {Promise<object>} - Market data object
 */
async function fetchBinanceMarketData(symbol = 'BTCUSDT') {
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
  const response = await axios.get(url);
  return response.data;
}

module.exports = {
  fetchBinanceMarketData,
};

