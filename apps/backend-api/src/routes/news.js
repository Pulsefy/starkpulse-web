const router = require('express').Router();
const newsController = require('../controllers/newsController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const rateLimit = require('../middleware/rateLimitMiddleware');
const { validateRequestSchema } = require('../middleware/validationMiddleware');

// Rate limit config for news endpoints
const newsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Public routes
// GET /api/news - Get all news with filters and pagination
router.get('/', newsRateLimit, newsController.getNews);

// GET /api/news/trending - Get trending news
router.get('/trending', newsRateLimit, newsController.getTrendingNews);

// GET /api/news/categories - Get all news categories
router.get('/categories', newsRateLimit, newsController.getNewsCategories);

// GET /api/news/sources - Get all news sources
router.get('/sources', newsRateLimit, newsController.getNewsSources);

// GET /api/news/coin/:symbol - Get news for specific cryptocurrency
router.get('/coin/:symbol', newsRateLimit, newsController.getCoinNews);

// GET /api/news/:id - Get news by ID
router.get('/:id', newsRateLimit, newsController.getNewsById);

// Admin only routes
// POST /api/news/fetch - Fetch news from external sources
router.post('/fetch', requireAuth, requireAdmin, newsController.fetchNews);

module.exports = router;
