/**
 * API v2 Routes
 * Main entry point for API v2 endpoints with enhanced features
 */

const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('../auth');
const userRoutes = require('../users');
const alertRoutes = require('../alert');
const analyticsRoutes = require('../analytics.routes');
const cryptoRoutes = require('../crypto');
const healthRoutes = require('../health');
const newsRoutes = require('../news');
const portfolioRoutes = require('../portfolio');
const starknetRoutes = require('../starknet');

// Mount routes with any v2-specific modifications
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/alerts', alertRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/crypto', cryptoRoutes);
router.use('/health', healthRoutes);
router.use('/news', newsRoutes);
router.use('/portfolio', portfolioRoutes);

router.use('/starknet', starknetRoutes);

// Advanced search and filtering routes
router.use('/search', require('../search'));

// Version-specific routes
router.get('/version', (req, res) => {
  res.json({
    version: 'v2',
    features: [
      'Enhanced performance',
      'Additional query parameters',
      'Expanded response data',
    ],
    documentation: '/api/docs/v2'
  });
});

module.exports = router;
