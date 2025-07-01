/**
 * Metrics Controller
 * Handles requests for system metrics in various formats for dashboard integration
 */

const {
  getPrometheusMetrics,
  getJsonMetrics,
  getDatadogMetrics,
  getMetricsHistory,
  DASHBOARD_FORMATS
} = require('../services/dashboardService');

const logger = require('../utils/logger');

/**
 * Get metrics in specified format
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {*} Metrics in requested format
 */
const getMetrics = (req, res) => {
  try {
    const format = req.query.format?.toLowerCase() || DASHBOARD_FORMATS.JSON;
    
    switch (format) {
      case DASHBOARD_FORMATS.PROMETHEUS:
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send(getPrometheusMetrics());
      
      case DASHBOARD_FORMATS.DATADOG:
        return res.status(200).json(getDatadogMetrics());
      
      case DASHBOARD_FORMATS.JSON:
        return res.status(200).json(getJsonMetrics());
      default:
        return res.status(200).json(getJsonMetrics());
    }
  } catch (error) {
    logger.error('Error retrieving metrics:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Error retrieving metrics',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get historical metrics data
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} Historical metrics data
 */
const getMetricsHistorical = async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10) || 100;
    const metrics = await getMetricsHistory(limit);
    
    res.status(200).json({
      status: 'OK',
      count: metrics.length,
      metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error retrieving historical metrics:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Error retrieving historical metrics',
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  getMetrics,
  getMetricsHistorical
};
