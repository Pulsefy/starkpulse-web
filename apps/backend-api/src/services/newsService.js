const axios = require('axios');
const { RateLimiter } = require('limiter');
const News = require('../models/News');
const { logger } = require('../utils/logger');
const { redisClient } = require('../config/redis');
const { analyzeSentiment, extractTags, categorizeArticle, extractCoins } = require('../utils/newsAnalyzer');

// Configure API keys for different news sources
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const CRYPTO_PANIC_API_KEY = process.env.CRYPTO_PANIC_API_KEY;
const CRYPTO_COMPARE_API_KEY = process.env.CRYPTO_COMPARE_API_KEY;

// Rate limiters for different APIs
const newsApiLimiter = new RateLimiter({ tokensPerInterval: 100, interval: 'day' });
const cryptoPanicLimiter = new RateLimiter({ tokensPerInterval: 60, interval: 'minute' });
const cryptoCompareLimiter = new RateLimiter({ tokensPerInterval: 50, interval: 'second' });

// Cache TTL in seconds
const CACHE_TTL = {
  NEWS_LIST: 5 * 60, // 5 minutes
  NEWS_DETAIL: 30 * 60, // 30 minutes
  NEWS_SEARCH: 2 * 60, // 2 minutes
};

/**
 * Fetch news from News API
 * @param {Object} options - Query parameters for the API
 * @returns {Promise<Array>} Array of news articles
 */
async function fetchFromNewsAPI(options = {}) {
  try {
    // Check rate limit before making request
    const remainingRequests = await newsApiLimiter.removeTokens(1);
    logger.debug(`NewsAPI remaining requests: ${remainingRequests}`);
    
    const params = {
      apiKey: NEWS_API_KEY,
      language: 'en',
      q: options.query || 'cryptocurrency OR bitcoin OR ethereum OR blockchain',
      pageSize: options.limit || 20,
      page: options.page || 1,
      sortBy: options.sortBy || 'publishedAt',
      ...options
    };
    
    const response = await axios.get('https://newsapi.org/v2/everything', { params });
    
    if (response.data?.articles) {
      return response.data.articles.map(article => ({
        title: article.title,
        content: article.content || article.description,
        summary: article.description,
        url: article.url,
        imageUrl: article.urlToImage,
        source: {
          name: article.source.name,
          url: null // NewsAPI doesn't provide source URLs
        },
        author: article.author,
        publishedAt: new Date(article.publishedAt),
        fetchedFrom: 'newsapi'
      }));
    }
    
    return [];
  } catch (error) {
    logger.error(`Error fetching from News API: ${error.message}`);
    return [];
  }
}

/**
 * Fetch news from CryptoPanic API
 * @param {Object} options - Query parameters for the API
 * @returns {Promise<Array>} Array of news articles
 */
async function fetchFromCryptoPanic(options = {}) {
  try {
    // Check rate limit before making request
    const remainingRequests = await cryptoPanicLimiter.removeTokens(1);
    logger.debug(`CryptoPanic remaining requests: ${remainingRequests}`);
    
    const params = {
      auth_token: CRYPTO_PANIC_API_KEY,
      filter: options.filter || 'hot',
      currencies: options.currencies || 'BTC,ETH',
      regions: 'en',
      page: options.page || 1,
      ...options
    };
    
    const response = await axios.get('https://cryptopanic.com/api/v1/posts/', { params });
    
    if (response.data?.results) {
      return response.data.results.map(article => ({
        title: article.title,
        content: article.body || article.title,
        summary: article.title,
        url: article.url,
        imageUrl: article.image_url || null,
        source: {
          name: article.source.title,
          url: article.source.domain
        },
        author: null, // CryptoPanic doesn't consistently provide author info
        publishedAt: new Date(article.published_at),
        fetchedFrom: 'cryptopanic',
        // Pre-tagged with currencies from CryptoPanic
        coins: article.currencies ? article.currencies.map(c => c.code.toLowerCase()) : []
      }));
    }
    
    return [];
  } catch (error) {
    logger.error(`Error fetching from CryptoPanic: ${error.message}`);
    return [];
  }
}

/**
 * Fetch news from CryptoCompare API
 * @param {Object} options - Query parameters for the API
 * @returns {Promise<Array>} Array of news articles
 */
async function fetchFromCryptoCompare(options = {}) {
  try {
    // Check rate limit before making request
    const remainingRequests = await cryptoCompareLimiter.removeTokens(1);
    logger.debug(`CryptoCompare remaining requests: ${remainingRequests}`);
    
    const params = {
      api_key: CRYPTO_COMPARE_API_KEY,
      feeds: options.feeds || '',
      categories: options.categories || 'BTC|ETH|XRP|Technology|Regulation',
      excludeCategories: options.excludeCategories || 'Sponsored',
      lTs: options.lTs || 0,
      lang: 'EN',
      sortOrder: options.sortOrder || 'latest',
      ...options
    };
    
    const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/', { params });
    
    if (response.data?.Data) {
      return response.data.Data.map(article => ({
        title: article.title,
        content: article.body,
        summary: `${article.body.substring(0, 300)}...`,
        url: article.url,
        imageUrl: article.imageurl,
        source: {
          name: article.source,
          url: article.source_info.link
        },
        author: null, // CryptoCompare doesn't consistently provide author info
        publishedAt: new Date(article.published_on * 1000), // Convert Unix timestamp to Date
        fetchedFrom: 'cryptocompare',
        categories: article.categories.split('|').map(c => c.trim().toLowerCase()),
        coins: article.categories.split('|')
          .filter(c => c.length <= 5) // Simple heuristic to identify coin symbols
          .map(c => c.trim().toLowerCase())
      }));
    }
    
    return [];
  } catch (error) {
    logger.error(`Error fetching from CryptoCompare: ${error.message}`);
    return [];
  }
}

/**
 * Process article by extracting tags, categories, and sentiment
 * @param {Object} article - The news article to process
 * @returns {Object} Processed article with tags, categories, and sentiment
 */
async function processArticle(article) {
  try {
    // If the article already has categories and tags, keep them
    const processedArticle = { ...article };
    
    // Extract tags if not already present
    if (!processedArticle.tags || processedArticle.tags.length === 0) {
      processedArticle.tags = await extractTags(`${article.title} ${article.content}`);
    }
    
    // Categorize article if not already categorized
    if (!processedArticle.categories || processedArticle.categories.length === 0) {
      processedArticle.categories = await categorizeArticle(article.title, article.content);
    }
    
    // Extract mentioned cryptocurrencies if not already extracted
    if (!processedArticle.coins || processedArticle.coins.length === 0) {
      processedArticle.coins = await extractCoins(`${article.title} ${article.content}`);
    }
    
    // Analyze sentiment
    processedArticle.sentiment = await analyzeSentiment(article.title, article.content);
    
    return processedArticle;
  } catch (error) {
    logger.error(`Error processing article: ${error.message}`);
    return article; // Return original article if processing fails
  }
}

/**
 * Save news articles to the database
 * @param {Array} articles - Array of news articles to save
 * @returns {Promise<Array>} Array of saved articles
 */
async function saveNewsArticles(articles) {
  try {
    const savedArticles = [];
    
    for (const article of articles) {
      // Check if article with the same URL already exists
      const existingArticle = await News.findOne({ url: article.url });
      
      if (!existingArticle) {
        // Process the article before saving
        const processedArticle = await processArticle(article);
        
        // Create new article
        const newArticle = new News(processedArticle);
        await newArticle.save();
        savedArticles.push(newArticle);
        logger.debug(`Saved new article: ${article.title}`);
      } else {
        // Update existing article with any new information
        Object.assign(existingArticle, article);
        await existingArticle.save();
        savedArticles.push(existingArticle);
        logger.debug(`Updated existing article: ${article.title}`);
      }
    }
    
    return savedArticles;
  } catch (error) {
    logger.error(`Error saving news articles: ${error.message}`);
    return [];
  }
}

/**
 * Get news with caching
 * @param {Object} query - Query parameters
 * @param {Object} options - Pagination and sorting options
 * @returns {Promise<Array>} Array of news articles
 */
async function getNews(query = {}, options = {}) {
  try {
    const cacheKey = `news:${JSON.stringify(query)}:${JSON.stringify(options)}`;
    
    // Try to get from cache first
    const cachedNews = await redisClient.get(cacheKey);
    if (cachedNews) {
      logger.debug('Retrieved news from cache');
      return JSON.parse(cachedNews);
    }
    
    // If not in cache, fetch from database
    const news = await News.searchNews(query, options);
    
    // Save to cache
    await redisClient.set(
      cacheKey, 
      JSON.stringify(news), 
      'EX', 
      CACHE_TTL.NEWS_LIST
    );
    
    return news;
  } catch (error) {
    logger.error(`Error getting news: ${error.message}`);
    // If cache or other error, fall back to direct database query
    return News.searchNews(query, options);
  }
}

/**
 * Fetch news from all configured sources and save to database
 * @param {Object} options - Options for fetching news
 * @returns {Promise<Array>} Array of saved news articles
 */
async function fetchAndSaveNews(options = {}) {
  try {
    // Fetch from multiple sources in parallel
    const [newsApiArticles, cryptoPanicArticles, cryptoCompareArticles] = await Promise.all([
      fetchFromNewsAPI(options),
      fetchFromCryptoPanic(options),
      fetchFromCryptoCompare(options)
    ]);
    
    // Combine articles from all sources
    const allArticles = [
      ...newsApiArticles,
      ...cryptoPanicArticles,
      ...cryptoCompareArticles
    ];
    
    // Save articles to database
    const savedArticles = await saveNewsArticles(allArticles);
    
    return savedArticles;
  } catch (error) {
    logger.error(`Error in fetchAndSaveNews: ${error.message}`);
    return [];
  }
}

/**
 * Get trending news based on popularity
 * @param {Number} limit - Number of trending articles to retrieve
 * @returns {Promise<Array>} Array of trending news articles
 */
async function getTrendingNews(limit = 10) {
  try {
    const cacheKey = `news:trending:${limit}`;
    
    // Try to get from cache first
    const cachedNews = await redisClient.get(cacheKey);
    if (cachedNews) {
      return JSON.parse(cachedNews);
    }
    
    // If not in cache, fetch from database
    const trendingNews = await News.find({ isActive: true })
      .sort({ popularity: -1, publishedAt: -1 })
      .limit(limit)
      .lean();
    
    // Save to cache
    await redisClient.set(
      cacheKey, 
      JSON.stringify(trendingNews), 
      'EX', 
      CACHE_TTL.NEWS_LIST
    );
    
    return trendingNews;
  } catch (error) {
    logger.error(`Error getting trending news: ${error.message}`);
    // Fallback to direct database query
    return News.find({ isActive: true })
      .sort({ popularity: -1, publishedAt: -1 })
      .limit(limit)
      .lean();
  }
}

/**
 * Get news for specific cryptocurrency
 * @param {String} coinSymbol - Symbol of the cryptocurrency (e.g., "btc")
 * @param {Object} options - Pagination and sorting options
 * @returns {Promise<Array>} Array of news articles for the specified coin
 */
async function getCoinNews(coinSymbol, options = {}) {
  const query = {
    coins: coinSymbol.toLowerCase()
  };
  
  return getNews(query, options);
}

/**
 * Increment popularity counter for a news article
 * @param {String} articleId - ID of the article to update
 * @returns {Promise<Object>} Updated article
 */
async function incrementArticlePopularity(articleId) {
  try {
    const article = await News.findByIdAndUpdate(
      articleId,
      { $inc: { popularity: 1 } },
      { new: true }
    );
    
    // Invalidate caches that might contain this article
    await redisClient.del('news:trending:*');
    
    return article;
  } catch (error) {
    logger.error(`Error incrementing article popularity: ${error.message}`);
    return null;
  }
}

/**
 * Count news articles based on query
 * @param {Object} query - Query parameters
 * @returns {Promise<Number>} Count of matching articles
 */
async function countNews(query = {}) {
  try {
    const searchCriteria = {};
    
    // Apply the same filters as in the searchNews method
    if (query.searchTerm) {
      searchCriteria.$text = { $search: query.searchTerm };
    }
    
    if (query.source) {
      searchCriteria['source.name'] = query.source;
    }
    
    if (query.category) {
      searchCriteria.categories = query.category.toLowerCase();
    }
    
    if (query.tag) {
      searchCriteria.tags = query.tag.toLowerCase();
    }
    
    if (query.coin) {
      searchCriteria.coins = query.coin.toLowerCase();
    }
    
    if (query.sentiment) {
      searchCriteria.sentiment = query.sentiment;
    }
    
    if (query.fromDate || query.toDate) {
      searchCriteria.publishedAt = {};
      
      if (query.fromDate) {
        searchCriteria.publishedAt.$gte = new Date(query.fromDate);
      }
      
      if (query.toDate) {
        searchCriteria.publishedAt.$lte = new Date(query.toDate);
      }
    }
    
    if (!query.includeInactive) {
      searchCriteria.isActive = true;
    }
    
    return await News.countDocuments(searchCriteria);
  } catch (error) {
    logger.error(`Error counting news: ${error.message}`);
    return 0;
  }
}

/**
 * Get a single news article by ID
 * @param {String} id - News article ID
 * @returns {Promise<Object>} News article
 */
async function getNewsById(id) {
  try {
    const cacheKey = `news:article:${id}`;
    
    // Try to get from cache first
    const cachedArticle = await redisClient.get(cacheKey);
    if (cachedArticle) {
      return JSON.parse(cachedArticle);
    }
    
    // If not in cache, fetch from database
    const article = await News.findById(id).lean();
    
    if (article) {
      // Save to cache
      await redisClient.set(
        cacheKey, 
        JSON.stringify(article), 
        'EX', 
        CACHE_TTL.NEWS_DETAIL
      );
    }
    
    return article;
  } catch (error) {
    logger.error(`Error getting news by ID: ${error.message}`);
    return null;
  }
}

/**
 * Get all unique categories from news articles
 * @returns {Promise<Array>} Array of categories
 */
async function getNewsCategories() {
  try {
    const cacheKey = 'news:categories';
    
    // Try to get from cache first
    const cachedCategories = await redisClient.get(cacheKey);
    if (cachedCategories) {
      return JSON.parse(cachedCategories);
    }
    
    // If not in cache, fetch from database
    const categories = await News.distinct('categories');
    
    // Save to cache
    await redisClient.set(
      cacheKey, 
      JSON.stringify(categories), 
      'EX', 
      CACHE_TTL.NEWS_LIST
    );
    
    return categories;
  } catch (error) {
    logger.error(`Error getting news categories: ${error.message}`);
    return [];
  }
}

/**
 * Get all unique news sources
 * @returns {Promise<Array>} Array of news sources
 */
async function getNewsSources() {
  try {
    const cacheKey = 'news:sources';
    
    // Try to get from cache first
    const cachedSources = await redisClient.get(cacheKey);
    if (cachedSources) {
      return JSON.parse(cachedSources);
    }
    
    // If not in cache, fetch from database
    const sources = await News.distinct('source.name');
    
    // Save to cache
    await redisClient.set(
      cacheKey, 
      JSON.stringify(sources), 
      'EX', 
      CACHE_TTL.NEWS_LIST
    );
    
    return sources;
  } catch (error) {
    logger.error(`Error getting news sources: ${error.message}`);
    return [];
  }
}

module.exports = {
  fetchAndSaveNews,
  getNews,
  getTrendingNews,
  getCoinNews,
  incrementArticlePopularity,
  countNews,
  getNewsById,
  getNewsCategories,
  getNewsSources
};
