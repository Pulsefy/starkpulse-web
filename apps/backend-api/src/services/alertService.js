/**
 * Alert Service
 * Handles alerting for system health issues and performance degradation
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { getRedisClient } = require('../config/redis');

// Minimum time between alerts to prevent flooding
const ALERT_COOLDOWN_PERIOD = process.env.ALERT_COOLDOWN_PERIOD_MS || 1000 * 60 * 15; // 15 minutes default

// Email alert configuration
const EMAIL_CONFIG = {
  enabled: process.env.EMAIL_ALERTS_ENABLED === 'true',
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  from: process.env.EMAIL_FROM || 'alerts@starkpulse.io',
  to: process.env.EMAIL_ALERT_RECIPIENTS || 'admin@starkpulse.io',
};

// Alert thresholds
const THRESHOLDS = {
  // Database
  dbLatencyWarning: process.env.THRESHOLD_DB_LATENCY_WARNING || 100, // ms
  dbLatencyCritical: process.env.THRESHOLD_DB_LATENCY_CRITICAL || 500, // ms
  
  // Redis
  redisLatencyWarning: process.env.THRESHOLD_REDIS_LATENCY_WARNING || 50, // ms
  redisLatencyCritical: process.env.THRESHOLD_REDIS_LATENCY_CRITICAL || 200, // ms
  
  // API endpoints
  apiLatencyWarning: process.env.THRESHOLD_API_LATENCY_WARNING || 500, // ms
  apiLatencyCritical: process.env.THRESHOLD_API_LATENCY_CRITICAL || 2000, // ms
  
  // System
  memoryWarning: process.env.THRESHOLD_MEMORY_WARNING || 80, // percentage
  memoryCritical: process.env.THRESHOLD_MEMORY_CRITICAL || 95, // percentage
  
  // External services
  externalServiceLatencyWarning: process.env.THRESHOLD_EXTERNAL_LATENCY_WARNING || 1000, // ms
  externalServiceLatencyCritical: process.env.THRESHOLD_EXTERNAL_LATENCY_CRITICAL || 5000, // ms
};

/**
 * Create email transporter
 * @returns {object} Email transporter
 */
const createEmailTransporter = () => {
  if (!EMAIL_CONFIG.enabled || !EMAIL_CONFIG.host || !EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
    logger.warn('Email alerts are disabled or not properly configured');
    return null;
  }

  return nodemailer.createTransport({
    host: EMAIL_CONFIG.host,
    port: EMAIL_CONFIG.port,
    secure: EMAIL_CONFIG.secure,
    auth: EMAIL_CONFIG.auth,
  });
};

/**
 * Send an email alert
 * @param {string} subject - Alert subject
 * @param {string} message - Alert message
 * @param {string} severity - Alert severity (warning, critical)
 */
const sendEmailAlert = async (subject, message, severity = 'warning') => {
  try {
    const transporter = createEmailTransporter();
    if (!transporter) {
      return;
    }

    const emailSubject = `[StarkPulse ${severity.toUpperCase()}] ${subject}`;
    await transporter.sendMail({
      from: EMAIL_CONFIG.from,
      to: EMAIL_CONFIG.to,
      subject: emailSubject,
      text: message,
      html: `<div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: ${severity === 'critical' ? '#d9534f' : '#f0ad4e'};">${emailSubject}</h2>
        <p>${message}</p>
        <p style="color: #666;">Generated: ${new Date().toISOString()}</p>
      </div>`,
    });

    logger.info(`${severity} alert email sent: ${subject}`);
  } catch (error) {
    logger.error('Failed to send email alert:', error);
  }
};

/**
 * Check if an alert can be sent (respects cooldown period)
 * @param {string} alertKey - Unique key for the alert
 * @returns {boolean} True if alert can be sent
 */
const canSendAlert = async (alertKey) => {
  try {
    const redis = getRedisClient();
    const redisKey = `alert_cooldown:${alertKey}`;
    const lastAlertTime = await redis.get(redisKey);

    if (!lastAlertTime) {
      // No recent alert, can send
      await redis.set(redisKey, Date.now().toString(), 'PX', ALERT_COOLDOWN_PERIOD);
      return true;
    }

    // Check if cooldown period has passed
    const timeSinceLastAlert = Date.now() - Number.parseInt(lastAlertTime, 10);
    if (timeSinceLastAlert >= ALERT_COOLDOWN_PERIOD) {
      await redis.set(redisKey, Date.now().toString(), 'PX', ALERT_COOLDOWN_PERIOD);
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Error checking alert cooldown:', error);
    // If Redis fails, allow the alert to be sent
    return true;
  }
};

/**
 * Process health check results and trigger alerts if needed
 * @param {object} healthData - Health check data
 */
const processHealthAlert = async (healthData) => {
  try {
    const alerts = [];

    // Check overall system status
    if (healthData.status !== 'OK') {
      alerts.push({
        key: 'system_status',
        subject: 'System Status Degraded',
        message: `System status is ${healthData.status}. Please check the health dashboard.`,
        severity: 'warning',
      });
    }

    // Check database status
    if (healthData.dependencies?.database?.status !== 'OK') {
      alerts.push({
        key: 'database_status',
        subject: 'Database Connection Issue',
        message: `Database status is ${healthData.dependencies.database.status}.`,
        severity: 'critical',
      });
    } else if (healthData.dependencies?.database?.latency) {
      const dbLatency = Number.parseFloat(healthData.dependencies.database.latency);
      if (dbLatency >= THRESHOLDS.dbLatencyCritical) {
        alerts.push({
          key: 'database_latency_critical',
          subject: 'Database Latency Critical',
          message: `Database latency is ${dbLatency}ms, which exceeds critical threshold of ${THRESHOLDS.dbLatencyCritical}ms.`,
          severity: 'critical',
        });
      } else if (dbLatency >= THRESHOLDS.dbLatencyWarning) {
        alerts.push({
          key: 'database_latency_warning',
          subject: 'Database Latency Warning',
          message: `Database latency is ${dbLatency}ms, which exceeds warning threshold of ${THRESHOLDS.dbLatencyWarning}ms.`,
          severity: 'warning',
        });
      }
    }

    // Check cache status
    if (healthData.dependencies?.cache?.status !== 'OK') {
      alerts.push({
        key: 'cache_status',
        subject: 'Cache Connection Issue',
        message: `Cache (Redis) status is ${healthData.dependencies.cache.status}.`,
        severity: 'warning',
      });
    }

    // Check external services
    if (healthData.dependencies?.externalServices) {
      const externalServices = healthData.dependencies.externalServices;
      for (const serviceName of Object.keys(externalServices)) {
        const service = externalServices[serviceName];
        if (service.status !== 'OK') {
          alerts.push({
            key: `external_${serviceName}`,
            subject: `External Service Issue: ${serviceName}`,
            message: `Service ${serviceName} status is ${service.status}: ${service.message || 'No details available'}`,
            severity: 'warning',
          });
        }
      }
    }

    // Check system metrics (memory usage)
    if (healthData.system?.memory?.percentUsed) {
      const memUsage = Number.parseFloat(healthData.system.memory.percentUsed);
      if (memUsage >= THRESHOLDS.memoryCritical) {
        alerts.push({
          key: 'memory_critical',
          subject: 'Memory Usage Critical',
          message: `Memory usage is at ${memUsage}%, which exceeds critical threshold of ${THRESHOLDS.memoryCritical}%.`,
          severity: 'critical',
        });
      } else if (memUsage >= THRESHOLDS.memoryWarning) {
        alerts.push({
          key: 'memory_warning',
          subject: 'Memory Usage Warning',
          message: `Memory usage is at ${memUsage}%, which exceeds warning threshold of ${THRESHOLDS.memoryWarning}%.`,
          severity: 'warning',
        });
      }
    }

    // Send alerts (respecting cooldown)
    for (const alert of alerts) {
      const canSend = await canSendAlert(alert.key);
      if (canSend) {
        await sendEmailAlert(alert.subject, alert.message, alert.severity);
        
        // Log the alert
        if (alert.severity === 'critical') {
          logger.error(alert.subject, { details: alert.message });
        } else {
          logger.warn(alert.subject, { details: alert.message });
        }
      }
    }

    return alerts.length > 0;
  } catch (error) {
    logger.error('Error processing health alerts:', error);
    return false;
  }
};

module.exports = {
  processHealthAlert,
  sendEmailAlert,
  THRESHOLDS,
};
