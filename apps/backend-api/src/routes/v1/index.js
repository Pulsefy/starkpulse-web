/**
 * API v1 Routes
 * Main entry point for API v1 endpoints
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
const searchRoutes = require('./search');

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/alerts', alertRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/crypto', cryptoRoutes);
router.use('/health', healthRoutes);
router.use('/news', newsRoutes);
router.use('/portfolio', portfolioRoutes);
router.use('/starknet', starknetRoutes);
router.use('/search', searchRoutes);

module.exports = router;
