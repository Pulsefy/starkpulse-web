/**
 * Mock Data Generation Utility
 * 
 * This utility provides functions to generate consistent mock data for tests.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Generate a random string of specified length
 * @param {number} length - Length of the string to generate
 * @returns {string} Random string
 */
const generateRandomString = (length = 10) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  
  return result;
};

/**
 * Generate a mock user
 * @param {Object} overrides - Optional properties to override defaults
 * @returns {Object} Mock user object
 */
const generateMockUser = (overrides = {}) => {
  const userId = new mongoose.Types.ObjectId();
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync('Password123!', salt);
  
  return {
    _id: userId,
    username: `test_user_${generateRandomString(5)}`,
    email: `test_${generateRandomString(8)}@example.com`,
    password: hashedPassword,
    verified: true,
    loginAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
};

/**
 * Generate an auth token pair
 * @param {Object} user - User object to generate tokens for
 * @returns {Object} Object containing access and refresh tokens
 */
const generateAuthTokens = (user) => {
  return {
    accessToken: `mock_access_token_${user._id}_${generateRandomString(20)}`,
    refreshToken: `mock_refresh_token_${user._id}_${generateRandomString(30)}`
  };
};

/**
 * Generate mock crypto asset data
 * @param {number} count - Number of crypto assets to generate
 * @returns {Array} Array of mock crypto assets
 */
const generateMockCryptoAssets = (count = 10) => {
  const assets = [];
  const symbols = ['BTC', 'ETH', 'DOT', 'ADA', 'SOL', 'AVAX', 'MATIC', 'BNB', 'XRP', 'ATOM'];
  const names = [
    'Bitcoin', 'Ethereum', 'Polkadot', 'Cardano', 'Solana', 
    'Avalanche', 'Polygon', 'Binance Coin', 'Ripple', 'Cosmos'
  ];
  
  for (let i = 0; i < count && i < symbols.length; i++) {
    const price = Math.random() * 10000;
    assets.push({
      symbol: symbols[i],
      name: names[i],
      price: price.toFixed(2),
      change24h: (Math.random() * 10 - 5).toFixed(2),
      marketCap: Math.floor(price * (1000000 + Math.random() * 900000000)),
      volume24h: Math.floor(100000 + Math.random() * 9000000)
    });
  }
  
  return assets;
};

/**
 * Generate mock portfolio data
 * @param {Object} user - User to generate portfolio for
 * @param {number} assetCount - Number of assets in portfolio
 * @returns {Object} Mock portfolio object
 */
const generateMockPortfolio = (user, assetCount = 5) => {
  const assets = [];
  const symbols = ['BTC', 'ETH', 'DOT', 'ADA', 'SOL', 'AVAX', 'MATIC', 'BNB', 'XRP', 'ATOM'];
  
  for (let i = 0; i < assetCount && i < symbols.length; i++) {
    assets.push({
      symbol: symbols[i],
      amount: (Math.random() * 100).toFixed(6),
      buyPrice: (Math.random() * 10000).toFixed(2),
      currentPrice: (Math.random() * 10000).toFixed(2)
    });
  }
  
  return {
    userId: user._id,
    totalValue: assets.reduce((sum, asset) => sum + Number.parseFloat(asset.amount) * Number.parseFloat(asset.currentPrice), 0),
    assets,
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

/**
 * Generate mock news articles
 * @param {number} count - Number of news articles to generate
 * @returns {Array} Array of mock news articles
 */
const generateMockNewsArticles = (count = 10) => {
  const articles = [];
  const sources = ['CoinDesk', 'CryptoNews', 'Bloomberg', 'Reuters', 'Decrypt'];
  
  for (let i = 0; i < count; i++) {
    articles.push({
      _id: new mongoose.Types.ObjectId(),
      title: `Crypto News Article ${i+1}: ${generateRandomString(20)}`,
      description: `This is a mock description for news article ${i+1}. ${generateRandomString(100)}`,
      source: sources[Math.floor(Math.random() * sources.length)],
      url: `https://example.com/news/${i+1}`,
      imageUrl: `https://example.com/images/news${i+1}.jpg`,
      publishedAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
      tags: ['crypto', 'blockchain', 'news']
    });
  }
  
  return articles;
};

module.exports = {
  generateRandomString,
  generateMockUser,
  generateAuthTokens,
  generateMockCryptoAssets,
  generateMockPortfolio,
  generateMockNewsArticles
};
