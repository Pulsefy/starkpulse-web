// News Sentiment Analysis Service
// Uses NLP to analyze news sentiment

const axios = require('axios');
// For demonstration, use a simple keyword-based sentiment scoring
const positiveWords = ['bull', 'surge', 'rise', 'gain', 'positive', 'rally', 'soar'];
const negativeWords = ['bear', 'drop', 'fall', 'loss', 'negative', 'crash', 'plunge'];

/**
 * Fetch recent crypto news headlines (using CryptoPanic public API as an example)
 * @returns {Promise<string[]>} Array of news headlines
 */
async function fetchCryptoNewsHeadlines() {
  const url = 'https://cryptopanic.com/api/v1/posts/?auth_token=demo&public=true';
  const response = await axios.get(url);
  return response.data.results.map(item => item.title);
}

/**
 * Simple sentiment analysis: +1 for positive, -1 for negative, 0 for neutral
 * @param {string} text
 * @returns {number} sentiment score
 */
function analyzeSentiment(text) {
  let score = 0;
  const lower = text.toLowerCase();
  positiveWords.forEach(word => { if (lower.includes(word)) score += 1; });
  negativeWords.forEach(word => { if (lower.includes(word)) score -= 1; });
  return score;
}

/**
 * Analyze sentiment for recent crypto news headlines
 * @returns {Promise<{headline: string, sentiment: number}[]>}
 */
async function getNewsSentiment() {
  const headlines = await fetchCryptoNewsHeadlines();
  return headlines.map(headline => ({
    headline,
    sentiment: analyzeSentiment(headline)
  }));
}

module.exports = {
  getNewsSentiment,
};
// Already implemented: fetches news headlines and analyzes sentiment using keywords.

