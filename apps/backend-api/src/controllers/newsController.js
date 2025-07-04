const newsService = require('../services/newsService');
const { ApiError } = require('../utils/errorHandler');
const { logger } = require('../utils/logger');

/**
 * @desc    Fetch and store news from external sources
 * @route   POST /api/news/fetch
 * @access  Private (Admin only)
 */
async function fetchNews(req, res, next) {
  try {
    const options = req.body || {};
    
    // Start news fetching process
    const articles = await newsService.fetchAndSaveNews(options);
    
    res.status(200).json({
      success: true,
      count: articles.length,
      message: `Successfully fetched ${articles.length} news articles`
    });
  } catch (error) {
    logger.error(`Error in fetchNews controller: ${error.message}`);
    next(new ApiError(error.message, 500));
  }
}

/**
 * @desc    Get paginated news with optional filters
 * @route   GET /api/news
 * @access  Public
 */
async function getNews(req, res, next) {
  try {
    // Extract query parameters for filtering
    const {
      search,
      source,
      category,
      tag,
      coin,
      sentiment,
      fromDate,
      toDate,
      page = 1,
      limit = 20,
      sortBy = 'publishedAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Build query object
    const query = {};
    
    if (search) query.searchTerm = search;
    if (source) query.source = source;
    if (category) query.category = category;
    if (tag) query.tag = tag;
    if (coin) query.coin = coin;
    if (sentiment) query.sentiment = sentiment;
    if (fromDate) query.fromDate = fromDate;
    if (toDate) query.toDate = toDate;
    
    // Build options object for pagination and sorting
    const options = {
      page: Number.parseInt(page, 10),
      limit: Number.parseInt(limit, 10),
      sortField: sortBy,
      sortOrder
    };
    
    // Get news articles
    const articles = await newsService.getNews(query, options);
    
    // Count total articles for pagination info
    const total = await newsService.countNews(query);
    
    res.status(200).json({
      success: true,
      count: articles.length,
      total,
      pagination: {
        page: options.page,
        limit: options.limit,
        pages: Math.ceil(total / options.limit)
      },
      data: articles
    });
  } catch (error) {
    logger.error(`Error in getNews controller: ${error.message}`);
    next(new ApiError(error.message, 500));
  }
}

/**
 * @desc    Get a single news article by ID
 * @route   GET /api/news/:id
 * @access  Public
 */
async function getNewsById(req, res, next) {
  try {
    const { id } = req.params;
    
    const article = await newsService.getNewsById(id);
    
    if (!article) {
      return next(new ApiError('News article not found', 404));
    }
    
    // Increment popularity counter when article is viewed
    await newsService.incrementArticlePopularity(id);
    
    res.status(200).json({
      success: true,
      data: article
    });
  } catch (error) {
    logger.error(`Error in getNewsById controller: ${error.message}`);
    next(new ApiError(error.message, 500));
  }
}

/**
 * @desc    Get trending news articles
 * @route   GET /api/news/trending
 * @access  Public
 */
async function getTrendingNews(req, res, next) {
  try {
    const { limit = 10 } = req.query;
    
    const articles = await newsService.getTrendingNews(Number.parseInt(limit, 10));
    
    res.status(200).json({
      success: true,
      count: articles.length,
      data: articles
    });
  } catch (error) {
    logger.error(`Error in getTrendingNews controller: ${error.message}`);
    next(new ApiError(error.message, 500));
  }
}

/**
 * @desc    Get news related to a specific cryptocurrency
 * @route   GET /api/news/coin/:symbol
 * @access  Public
 */
async function getCoinNews(req, res, next) {
  try {
    const { symbol } = req.params;
    const {
      page = 1,
      limit = 20,
      sortBy = 'publishedAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Build options object for pagination and sorting
    const options = {
      page: Number.parseInt(page, 10),
      limit: Number.parseInt(limit, 10),
      sortField: sortBy,
      sortOrder
    };
    
    const articles = await newsService.getCoinNews(symbol, options);
    
    res.status(200).json({
      success: true,
      count: articles.length,
      data: articles
    });
  } catch (error) {
    logger.error(`Error in getCoinNews controller: ${error.message}`);
    next(new ApiError(error.message, 500));
  }
}

/**
 * @desc    Get categories available in the news database
 * @route   GET /api/news/categories
 * @access  Public
 */
async function getNewsCategories(req, res, next) {
  try {
    const categories = await newsService.getNewsCategories();
    
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    logger.error(`Error in getNewsCategories controller: ${error.message}`);
    next(new ApiError(error.message, 500));
  }
}

/**
 * @desc    Get sources available in the news database
 * @route   GET /api/news/sources
 * @access  Public
 */
async function getNewsSources(req, res, next) {
  try {
    const sources = await newsService.getNewsSources();
    
    res.status(200).json({
      success: true,
      count: sources.length,
      data: sources
    });
  } catch (error) {
    logger.error(`Error in getNewsSources controller: ${error.message}`);
    next(new ApiError(error.message, 500));
  }
}

module.exports = {
  fetchNews,
  getNews,
  getNewsById,
  getTrendingNews,
  getCoinNews,
  getNewsCategories,
  getNewsSources
};
