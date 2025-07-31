// Correlation Analysis Service
// Analyzes correlation between assets

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
 * Calculate Pearson correlation coefficient between two arrays
 * @param {number[]} arr1
 * @param {number[]} arr2
 * @returns {number}
 */
function pearsonCorrelation(arr1, arr2) {
  const n = arr1.length;
  const mean1 = arr1.reduce((a, b) => a + b, 0) / n;
  const mean2 = arr2.reduce((a, b) => a + b, 0) / n;
  let num = 0, den1 = 0, den2 = 0;
  for (let i = 0; i < n; i++) {
    num += (arr1[i] - mean1) * (arr2[i] - mean2);
    den1 += (arr1[i] - mean1) ** 2;
    den2 += (arr2[i] - mean2) ** 2;
  }
  return num / Math.sqrt(den1 * den2);
}

/**
 * Get correlation between two assets
 * @param {string} symbol1
 * @param {string} symbol2
 * @returns {Promise<number>}
 */
async function getCorrelation(symbol1 = 'BTCUSDT', symbol2 = 'ETHUSDT') {
  const closes1 = await fetchCloses(symbol1);
  const closes2 = await fetchCloses(symbol2);
  if (closes1.length !== closes2.length) throw new Error('Mismatched data length');
  return pearsonCorrelation(closes1, closes2);
}

module.exports = {
  getCorrelation,
};

