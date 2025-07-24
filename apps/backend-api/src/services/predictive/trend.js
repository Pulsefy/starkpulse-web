// Market Trend Identification Service
// Identifies market trends

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
 * Identify simple trend: uptrend, downtrend, or sideways using moving averages
 * @param {string} symbol
 * @returns {Promise<string>} trend
 */
async function identifyTrend(symbol = 'BTCUSDT') {
  const closes = await fetchCloses(symbol);
  const n = closes.length;
  const maShort = closes.slice(n - 5).reduce((a, b) => a + b, 0) / 5;
  const maLong = closes.reduce((a, b) => a + b, 0) / n;
  if (maShort > maLong * 1.01) return 'uptrend';
  if (maShort < maLong * 0.99) return 'downtrend';
  return 'sideways';
}

module.exports = {
  identifyTrend,
};

