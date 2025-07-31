// Price Prediction Service
// Implements ML-based price prediction

const axios = require('axios');

/**
 * Fetch recent historical prices from Binance (last 24 hours, 1h interval)
 * @param {string} symbol - e.g., 'BTCUSDT'
 * @returns {Promise<number[]>} - Array of close prices
 */
async function fetchHistoricalPrices(symbol = 'BTCUSDT') {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=24`;
  const response = await axios.get(url);
  // Each kline: [openTime, open, high, low, close, ...]
  return response.data.map(kline => parseFloat(kline[4]));
}

/**
 * Simple price prediction: next price = mean of last 24 closes
 * @param {string} symbol
 * @returns {Promise<number>} predicted price
 */
async function predictPrice(symbol = 'BTCUSDT') {
  const closes = await fetchHistoricalPrices(symbol);
  const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
  return parseFloat(mean.toFixed(2));
}

module.exports = {
  predictPrice,
};

