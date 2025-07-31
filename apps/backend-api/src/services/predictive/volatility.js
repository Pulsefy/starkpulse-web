// Volatility Forecasting Service
// Predicts market volatility

const axios = require('axios');

/**
 * Fetch recent close prices from Binance for a symbol
 * @param {string} symbol
 * @returns {Promise<number[]>}
 */
async function fetchCloses(symbol = 'BTCUSDT') {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=24`;
  const response = await axios.get(url);
  return response.data.map(kline => parseFloat(kline[4]));
}

/**
 * Calculate standard deviation of log returns as volatility
 * @param {string} symbol
 * @returns {Promise<number>} volatility
 */
async function calculateVolatility(symbol = 'BTCUSDT') {
  const closes = await fetchCloses(symbol);
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance);
}

module.exports = {
  calculateVolatility,
};

