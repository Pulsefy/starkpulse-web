// Fear/Greed Index and Sentiment-Based Prediction Service

const newsSentiment = require('./news');
const volatilityService = require('../predictive/volatility');

/**
 * Compute a basic fear/greed index using news sentiment and volatility
 * @param {string} symbol
 * @returns {Promise<{index: number, label: string}>}
 */
async function computeFearGreedIndex(symbol = 'BTCUSDT') {
  // Get average news sentiment
  const news = await newsSentiment.getNewsSentiment();
  const avgSentiment = news.length ? news.reduce((a, b) => a + b.sentiment, 0) / news.length : 0;
  // Get volatility
  const volatility = await volatilityService.calculateVolatility(symbol);
  // Simple formula: index = 50 + 30*sentiment - 20*volatility
  let index = 50 + 30 * avgSentiment - 20 * volatility;
  index = Math.max(0, Math.min(100, Math.round(index)));
  let label = 'Neutral';
  if (index > 70) label = 'Greed';
  else if (index < 30) label = 'Fear';
  return { index, label };
}

module.exports = {
  computeFearGreedIndex,
};

