/**
 * Dashboard Integration Service
 * Provides integration with monitoring dashboards and data for visualization
 */

const os = require('node:os');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');
const { getCurrentMetrics } = require('../middleware/healthMonitor');

/**
 * Supported dashboard formats
 */
const DASHBOARD_FORMATS = {
  PROMETHEUS: 'prometheus',
  JSON: 'json',
  DATADOG: 'datadog',
  CUSTOM: 'custom',
};

/**
 * Get metric data in Prometheus format
 * @returns {string} Metrics in Prometheus format
 */
const getPrometheusMetrics = () => {
  const metrics = getCurrentMetrics();
  const timestamp = Math.floor(Date.now() / 1000);

  let output = '';
  
  // API metrics
  output += `# HELP api_request_count Total number of API requests\n`;
  output += `# TYPE api_request_count counter\n`;
  output += `api_request_count ${metrics.requestCount} ${timestamp}000\n\n`;
  
  output += `# HELP api_response_time_avg Average API response time in milliseconds\n`;
  output += `# TYPE api_response_time_avg gauge\n`;
  output += `api_response_time_avg ${metrics.responseTimeAvg.toFixed(3)} ${timestamp}000\n\n`;
  
  output += `# HELP api_error_count Total number of API errors (5xx responses)\n`;
  output += `# TYPE api_error_count counter\n`;
  output += `api_error_count ${metrics.errors} ${timestamp}000\n\n`;
  
  // System metrics
  output += `# HELP system_cpu_load_1m CPU load average 1m\n`;
  output += `# TYPE system_cpu_load_1m gauge\n`;
  output += `system_cpu_load_1m ${metrics.systemLoad[0].toFixed(3)} ${timestamp}000\n\n`;
  
  output += `# HELP system_memory_used_bytes Memory used in bytes\n`;
  output += `# TYPE system_memory_used_bytes gauge\n`;
  output += `system_memory_used_bytes ${metrics.totalMemory - metrics.freeMemory} ${timestamp}000\n\n`;
  
  output += `# HELP system_memory_total_bytes Total memory in bytes\n`;
  output += `# TYPE system_memory_total_bytes gauge\n`;
  output += `system_memory_total_bytes ${metrics.totalMemory} ${timestamp}000\n\n`;
  
  output += `# HELP system_uptime_seconds System uptime in seconds\n`;
  output += `# TYPE system_uptime_seconds counter\n`;
  output += `system_uptime_seconds ${metrics.uptime.toFixed(1)} ${timestamp}000\n`;

  // Status codes
  output += `# HELP api_status_codes Count of responses by status code\n`;
  output += `# TYPE api_status_codes counter\n`;
  Object.entries(metrics.statusCodes).forEach(([code, count]) => {
    output += `api_status_codes{code="${code}"} ${count} ${timestamp}000\n`;
  });
  
  return output;
};

/**
 * Get metric data in JSON format
 * @returns {object} Metrics in JSON format
 */
const getJsonMetrics = () => {
  const metrics = getCurrentMetrics();
  
  // Process status codes for better visualization
  const statusGroups = {
    '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0
  };
  
  Object.entries(metrics.statusCodes).forEach(([code, count]) => {
    const group = `${code[0]}xx`;
    if (statusGroups[group] !== undefined) {
      statusGroups[group] += count;
    }
  });
  
  return {
    api: {
      requestCount: metrics.requestCount,
      responseTimeAvg: parseFloat(metrics.responseTimeAvg.toFixed(2)),
      errorCount: metrics.errors,
      statusCodes: metrics.statusCodes,
      statusGroups
    },
    system: {
      uptime: metrics.uptime,
      load: metrics.systemLoad,
      memory: {
        total: metrics.totalMemory,
        free: metrics.freeMemory,
        used: metrics.totalMemory - metrics.freeMemory,
        percentUsed: parseFloat(((metrics.totalMemory - metrics.freeMemory) / metrics.totalMemory * 100).toFixed(2))
      },
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length
    },
    timestamp: metrics.timestamp
  };
};

/**
 * Get recent metrics history
 * @param {number} limit - Max number of records to retrieve
 * @returns {array} Array of metric data points
 */
const getMetricsHistory = async (limit = 100) => {
  try {
    const redis = getRedisClient();
    
    // Get recent metrics keys
    const keys = await redis.lrange('metrics:recent', 0, limit - 1);
    if (!keys || keys.length === 0) {
      return [];
    }
    
    // Get metric data for each key
    const metricPromises = keys.map(key => redis.get(key));
    const results = await Promise.all(metricPromises);
    
    // Parse and return metrics
    return results
      .filter(Boolean) 
      .map(data => {
        try {
          return JSON.parse(data);
        } catch (e) {
          logger.error('Error parsing metrics data:', e);
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
  } catch (error) {
    logger.error('Error retrieving metrics history:', error);
    return [];
  }
};

/**
 * Format metrics for Datadog
 * @returns {object} Metrics formatted for Datadog
 */
const getDatadogMetrics = () => {
  const metrics = getCurrentMetrics();
  const timestamp = Math.floor(Date.now() / 1000);
  
  const series = [
    {
      metric: 'starkpulse.api.request_count',
      points: [[timestamp, metrics.requestCount]],
      type: 'count',
      tags: ['service:api', 'env:' + process.env.NODE_ENV || 'development']
    },
    {
      metric: 'starkpulse.api.response_time',
      points: [[timestamp, metrics.responseTimeAvg]],
      type: 'gauge',
      tags: ['service:api', 'env:' + process.env.NODE_ENV || 'development']
    },
    {
      metric: 'starkpulse.api.error_count',
      points: [[timestamp, metrics.errors]],
      type: 'count',
      tags: ['service:api', 'env:' + process.env.NODE_ENV || 'development']
    },
    {
      metric: 'starkpulse.system.memory.used_percent',
      points: [[timestamp, (metrics.totalMemory - metrics.freeMemory) / metrics.totalMemory * 100]],
      type: 'gauge',
      tags: ['service:api', 'env:' + process.env.NODE_ENV || 'development']
    },
    {
      metric: 'starkpulse.system.cpu.load',
      points: [[timestamp, metrics.systemLoad[0]]],
      type: 'gauge',
      tags: ['service:api', 'env:' + process.env.NODE_ENV || 'development']
    }
  ];
  
  // Add status code metrics
  Object.entries(metrics.statusCodes).forEach(([code, count]) => {
    series.push({
      metric: 'starkpulse.api.status_code',
      points: [[timestamp, count]],
      type: 'count',
      tags: ['service:api', 'status:' + code, 'env:' + process.env.NODE_ENV || 'development']
    });
  });
  
  return { series };
};

module.exports = {
  DASHBOARD_FORMATS,
  getPrometheusMetrics,
  getJsonMetrics,
  getDatadogMetrics,
  getMetricsHistory
};
