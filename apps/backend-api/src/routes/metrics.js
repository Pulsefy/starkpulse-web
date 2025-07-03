/**
 * Metrics Routes
 * Provides endpoints for system metrics and monitoring data
 */

const express = require('express');
const router = express.Router();
const metricsController = require('../controllers/metricsController');

/**
 * @route   GET /api/metrics
 * @desc    Get current system metrics
 * @access  Private
 * @query   format - Output format (json, prometheus, datadog)
 */
router.get('/', metricsController.getMetrics);

/**
 * @route   GET /api/metrics/history
 * @desc    Get historical metrics data
 * @access  Private
 * @query   limit - Number of data points to retrieve (default: 100)
 */
router.get('/history', metricsController.getMetricsHistorical);

module.exports = router;
