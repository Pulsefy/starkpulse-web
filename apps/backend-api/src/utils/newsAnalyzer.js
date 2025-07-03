/**
 * News Analyzer utility
 * 
 * Provides functions for analyzing news articles:
 * - Extract tags from article text
 * - Categorize articles based on content
 * - Extract mentioned cryptocurrencies
 * - Analyze sentiment of article text
 */

const logger = require('./logger').logger;

// Common cryptocurrency names and their symbols for extraction
const COMMON_CRYPTOCURRENCIES = {
  'bitcoin': 'btc',
  'ethereum': 'eth',
  'ripple': 'xrp',
  'litecoin': 'ltc',
  'cardano': 'ada',
  'polkadot': 'dot',
  'solana': 'sol',
  'dogecoin': 'doge',
  'shiba inu': 'shib',
  'tether': 'usdt',
  'usd coin': 'usdc',
  'binance coin': 'bnb',
  'avalanche': 'avax',
  'polygon': 'matic',
  'chainlink': 'link'
};

// Predefined categories for cryptocurrency news
const NEWS_CATEGORIES = {
  'market': ['price', 'trading', 'market', 'bull', 'bear', 'trend', 'crash', 'rally', 'correction', 'analysis', 'prediction'],
  'technology': ['blockchain', 'protocol', 'layer', 'scaling', 'consensus', 'smart contract', 'dapp', 'web3', 'network', 'development'],
  'regulation': ['regulation', 'law', 'compliance', 'sec', 'legal', 'government', 'policy', 'ban', 'tax', 'kyc', 'aml'],
  'adoption': ['adoption', 'partnership', 'integration', 'mainstream', 'institutional', 'retail', 'payment', 'merchant'],
  'defi': ['defi', 'yield', 'lending', 'borrowing', 'liquidity', 'amm', 'dex', 'swap', 'staking', 'farming'],
  'nft': ['nft', 'collectible', 'art', 'metaverse', 'gaming', 'virtual', 'token'],
  'mining': ['mining', 'miner', 'hash', 'proof of work', 'asic', 'difficulty', 'energy', 'reward']
};

/**
 * Extract tags from article text
 * @param {String} text - Article text to analyze
 * @returns {Array} Array of extracted tags
 */
async function extractTags(text) {
  try {
    const tags = new Set();
    const lowercaseText = text.toLowerCase();
    
    // Extract tags based on keyword frequency
    const words = lowercaseText.split(/\W+/);
    const wordFrequency = {};
    
    // Count word frequencies
    for (const word of words) {
      if (word.length > 3) { // Ignore very short words
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    }
    
    // Sort by frequency and take top keywords
    const sortedWords = Object.entries(wordFrequency)
      .sort((a, b) => b[1] - a[1])
      .filter(([word]) => !['this', 'that', 'with', 'from', 'have', 'were', 'they', 'their', 'about'].includes(word))
      .slice(0, 10)
      .map(([word]) => word);
    
    // Add most frequent words as tags
    for (const word of sortedWords) {
      tags.add(word);
    }
    
    // Check for specific crypto terms and add as tags
    for (const [crypto, symbol] of Object.entries(COMMON_CRYPTOCURRENCIES)) {
      if (lowercaseText.includes(crypto) || lowercaseText.includes(symbol)) {
        tags.add(crypto);
      }
    }
    
    // Check for specific category terms and add as tags
    for (const [category, keywords] of Object.entries(NEWS_CATEGORIES)) {
      for (const keyword of keywords) {
        if (lowercaseText.includes(keyword)) {
          tags.add(category);
          break;
        }
      }
    }
    
    return [...tags];
  } catch (error) {
    logger.error(`Error extracting tags: ${error.message}`);
    return [];
  }
}

/**
 * Categorize article based on content
 * @param {String} title - Article title
 * @param {String} content - Article content
 * @returns {Array} Array of categories
 */
async function categorizeArticle(title, content) {
  try {
    const categories = new Set();
    const combinedText = `${title} ${content}`.toLowerCase();
    
    // Check each category and its keywords
    for (const [category, keywords] of Object.entries(NEWS_CATEGORIES)) {
      for (const keyword of keywords) {
        if (combinedText.includes(keyword)) {
          categories.add(category);
          break;
        }
      }
    }
    
    // If no categories were found, add a default category
    if (categories.size === 0) {
      categories.add('general');
    }
    
    return [...categories];
  } catch (error) {
    logger.error(`Error categorizing article: ${error.message}`);
    return ['general']; // Default fallback category
  }
}

/**
 * Extract mentioned cryptocurrencies from text
 * @param {String} text - Text to analyze
 * @returns {Array} Array of cryptocurrency symbols
 */
async function extractCoins(text) {
  try {
    const coins = new Set();
    const lowercaseText = text.toLowerCase();
    
    // Check for cryptocurrency names and symbols
    for (const [name, symbol] of Object.entries(COMMON_CRYPTOCURRENCIES)) {
      if (lowercaseText.includes(name) || lowercaseText.includes(symbol)) {
        coins.add(symbol);
      }
    }
    
    return [...coins];
  } catch (error) {
    logger.error(`Error extracting coins: ${error.message}`);
    return [];
  }
}

/**
 * Analyze sentiment of article text
 * @param {String} title - Article title
 * @param {String} content - Article content
 * @returns {String} Sentiment (positive, negative, neutral)
 */
async function analyzeSentiment(title, content) {
  try {
    const combinedText = `${title} ${content}`.toLowerCase();
    
    // Simple keyword-based sentiment analysis
    // In a real application, this would use a more sophisticated sentiment analysis library
    const positiveKeywords = [
      'bullish', 'surge', 'rally', 'gain', 'profit', 'growth', 'positive', 'boost',
      'rise', 'increasing', 'breakthrough', 'adoption', 'success', 'innovative', 'potential',
      'opportunity', 'progress', 'partnership', 'integration', 'support'
    ];
    
    const negativeKeywords = [
      'bearish', 'crash', 'plunge', 'drop', 'loss', 'decline', 'negative', 'fall',
      'decreasing', 'hack', 'scam', 'fraud', 'ban', 'regulation', 'restriction',
      'concern', 'warning', 'risk', 'threat', 'volatility', 'uncertainty'
    ];
    
    let positiveScore = 0;
    let negativeScore = 0;
    
    // Count occurrences of positive and negative keywords
    for (const keyword of positiveKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = combinedText.match(regex);
      if (matches) {
        positiveScore += matches.length;
      }
    }
    
    for (const keyword of negativeKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = combinedText.match(regex);
      if (matches) {
        negativeScore += matches.length;
      }
    }
    
    // Determine overall sentiment
    if (positiveScore > negativeScore + 2) {
      return 'positive';
    } 
    if (negativeScore > positiveScore + 2) {
      return 'negative';
    } 
    return 'neutral';
  } catch (error) {
    logger.error(`Error analyzing sentiment: ${error.message}`);
    return 'neutral'; // Default fallback sentiment
  }
}

module.exports = {
  extractTags,
  categorizeArticle,
  extractCoins,
  analyzeSentiment
};
