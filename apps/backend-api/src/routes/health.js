/**
 * Health check routes
 * Provides endpoints for system health monitoring
 */

const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

/**
 * @route   GET /api/health
 * @desc    Basic health check endpoint
 * @access  Public
 */
router.get('/', healthController.getBasicHealth);

/**
 * @route   GET /api/health/detailed
 * @desc    Detailed health check with system metrics and dependencies
 * @access  Private (should be protected in production)
 */
router.get('/detailed', healthController.getDetailedHealth);

module.exports = router;
