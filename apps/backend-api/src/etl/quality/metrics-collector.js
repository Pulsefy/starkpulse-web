/**
 * Metrics Collector for ETL Operations
 * Collects and manages performance and quality metrics
 */

const EventEmitter = require('eventemitter3');
const logger = require('../../utils/logger');

class MetricsCollector extends EventEmitter {
	constructor(config = {}) {
		super();

		this.config = {
			enabled: config.enabled !== false,
			flushInterval: config.flushInterval || 60000, // 1 minute
			retentionPeriod: config.retentionPeriod || 7 * 24 * 60 * 60 * 1000, // 7 days
			aggregationWindow: config.aggregationWindow || 5 * 60 * 1000, // 5 minutes
			...config,
		};

		this.metrics = new Map();
		this.aggregatedMetrics = new Map();
		this.flushTimer = null;
		this.initialized = false;
	}

	/**
	 * Initialize the metrics collector
	 */
	async initialize() {
		if (this.initialized) {
			return;
		}

		try {
			logger.info('Initializing Metrics Collector...');

			if (this.config.enabled) {
				this.startPeriodicFlush();
			}

			this.initialized = true;
			logger.info('Metrics Collector initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize Metrics Collector:', error);
			throw error;
		}
	}

	/**
	 * Collect a metric
	 */
	async collect(metric) {
		if (!this.config.enabled || !this.initialized) {
			return;
		}

		try {
			const timestamp = Date.now();
			const metricKey = this.generateMetricKey(metric);

			const metricData = {
				...metric,
				timestamp,
				id: `${metricKey}-${timestamp}`,
			};

			// Store raw metric
			if (!this.metrics.has(metricKey)) {
				this.metrics.set(metricKey, []);
			}

			this.metrics.get(metricKey).push(metricData);

			// Update aggregated metrics
			this.updateAggregatedMetrics(metricKey, metricData);

			// Clean old metrics
			this.cleanOldMetrics();

			this.emit('metric_collected', metricData);
		} catch (error) {
			logger.error('Failed to collect metric:', error);
		}
	}

	/**
	 * Get metrics by key pattern
	 */
	getMetrics(pattern = null) {
		if (!pattern) {
			return Object.fromEntries(this.metrics);
		}

		const matchingMetrics = {};
		for (const [key, metrics] of this.metrics) {
			if (key.includes(pattern) || key.match(new RegExp(pattern))) {
				matchingMetrics[key] = metrics;
			}
		}

		return matchingMetrics;
	}

	/**
	 * Get aggregated metrics
	 */
	getAggregatedMetrics(pattern = null) {
		if (!pattern) {
			return Object.fromEntries(this.aggregatedMetrics);
		}

		const matchingMetrics = {};
		for (const [key, metrics] of this.aggregatedMetrics) {
			if (key.includes(pattern) || key.match(new RegExp(pattern))) {
				matchingMetrics[key] = metrics;
			}
		}

		return matchingMetrics;
	}

	/**
	 * Get pipeline metrics
	 */
	getPipelineMetrics(pipelineId) {
		return this.getMetrics(`pipeline.${pipelineId}`);
	}

	/**
	 * Get system metrics
	 */
	getSystemMetrics() {
		return {
			totalMetrics: Array.from(this.metrics.values()).reduce(
				(sum, metrics) => sum + metrics.length,
				0
			),
			metricsKeys: this.metrics.size,
			aggregatedKeys: this.aggregatedMetrics.size,
			memoryUsage: process.memoryUsage(),
			uptime: process.uptime(),
		};
	}

	/**
	 * Generate metric key
	 */
	generateMetricKey(metric) {
		const parts = [];

		if (metric.type) {
			parts.push(metric.type);
		}

		if (metric.pipelineId) {
			parts.push(`pipeline.${metric.pipelineId}`);
		}

		if (metric.component) {
			parts.push(`component.${metric.component}`);
		}

		if (metric.operation) {
			parts.push(`operation.${metric.operation}`);
		}

		return parts.join('.');
	}

	/**
	 * Update aggregated metrics
	 */
	updateAggregatedMetrics(metricKey, metricData) {
		if (!this.aggregatedMetrics.has(metricKey)) {
			this.aggregatedMetrics.set(metricKey, {
				count: 0,
				sum: 0,
				min: Number.MAX_SAFE_INTEGER,
				max: Number.MIN_SAFE_INTEGER,
				avg: 0,
				latest: null,
				firstSeen: Date.now(),
				lastUpdated: Date.now(),
			});
		}

		const aggregated = this.aggregatedMetrics.get(metricKey);

		// Update count
		aggregated.count++;

		// Update value-based metrics if available
		if (typeof metricData.value === 'number') {
			aggregated.sum += metricData.value;
			aggregated.min = Math.min(aggregated.min, metricData.value);
			aggregated.max = Math.max(aggregated.max, metricData.value);
			aggregated.avg = aggregated.sum / aggregated.count;
		}

		// Update timestamps and latest data
		aggregated.latest = metricData;
		aggregated.lastUpdated = Date.now();

		// Custom aggregations based on metric type
		if (metricData.duration) {
			if (!aggregated.durations) {
				aggregated.durations = {
					sum: 0,
					min: Number.MAX_SAFE_INTEGER,
					max: Number.MIN_SAFE_INTEGER,
					avg: 0,
				};
			}

			aggregated.durations.sum += metricData.duration;
			aggregated.durations.min = Math.min(
				aggregated.durations.min,
				metricData.duration
			);
			aggregated.durations.max = Math.max(
				aggregated.durations.max,
				metricData.duration
			);
			aggregated.durations.avg = aggregated.durations.sum / aggregated.count;
		}

		if (metricData.recordsProcessed) {
			if (!aggregated.records) {
				aggregated.records = {
					total: 0,
					successful: 0,
					failed: 0,
				};
			}

			aggregated.records.total += metricData.recordsProcessed || 0;
			aggregated.records.successful += metricData.recordsSuccessful || 0;
			aggregated.records.failed += metricData.recordsFailed || 0;
		}
	}

	/**
	 * Clean old metrics
	 */
	cleanOldMetrics() {
		const cutoffTime = Date.now() - this.config.retentionPeriod;

		for (const [key, metrics] of this.metrics) {
			const filteredMetrics = metrics.filter(
				(metric) => metric.timestamp > cutoffTime
			);

			if (filteredMetrics.length === 0) {
				this.metrics.delete(key);
				this.aggregatedMetrics.delete(key);
			} else if (filteredMetrics.length < metrics.length) {
				this.metrics.set(key, filteredMetrics);
			}
		}
	}

	/**
	 * Start periodic flush of metrics
	 */
	startPeriodicFlush() {
		if (this.flushTimer) {
			return;
		}

		this.flushTimer = setInterval(() => {
			this.flush();
		}, this.config.flushInterval);
	}

	/**
	 * Stop periodic flush
	 */
	stopPeriodicFlush() {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = null;
		}
	}

	/**
	 * Flush metrics (emit aggregated data)
	 */
	flush() {
		try {
			const aggregatedData = this.getAggregatedMetrics();
			const systemMetrics = this.getSystemMetrics();

			this.emit('metrics_flush', {
				timestamp: Date.now(),
				aggregated: aggregatedData,
				system: systemMetrics,
			});

			logger.debug('Metrics flushed', {
				metricsCount: Object.keys(aggregatedData).length,
				systemMetrics,
			});
		} catch (error) {
			logger.error('Failed to flush metrics:', error);
		}
	}

	/**
	 * Reset all metrics
	 */
	reset() {
		this.metrics.clear();
		this.aggregatedMetrics.clear();
		logger.info('All metrics reset');
		this.emit('metrics_reset');
	}

	/**
	 * Reset metrics for specific pattern
	 */
	resetMetrics(pattern) {
		const keysToDelete = [];

		for (const key of this.metrics.keys()) {
			if (key.includes(pattern) || key.match(new RegExp(pattern))) {
				keysToDelete.push(key);
			}
		}

		for (const key of keysToDelete) {
			this.metrics.delete(key);
			this.aggregatedMetrics.delete(key);
		}

		logger.info(`Reset metrics matching pattern: ${pattern}`);
		this.emit('metrics_reset', { pattern, count: keysToDelete.length });
	}

	/**
	 * Export metrics for external storage
	 */
	exportMetrics(format = 'json') {
		const data = {
			timestamp: Date.now(),
			raw: Object.fromEntries(this.metrics),
			aggregated: Object.fromEntries(this.aggregatedMetrics),
			system: this.getSystemMetrics(),
		};

		switch (format) {
			case 'json':
				return JSON.stringify(data, null, 2);
			case 'csv':
				return this.convertToCSV(data);
			default:
				return data;
		}
	}

	/**
	 * Convert metrics to CSV format
	 */
	convertToCSV(data) {
		const rows = [];
		rows.push(['metric_key', 'timestamp', 'count', 'sum', 'min', 'max', 'avg']);

		for (const [key, metrics] of Object.entries(data.aggregated)) {
			rows.push([
				key,
				metrics.lastUpdated,
				metrics.count,
				metrics.sum || 0,
				metrics.min === Number.MAX_SAFE_INTEGER ? 0 : metrics.min,
				metrics.max === Number.MIN_SAFE_INTEGER ? 0 : metrics.max,
				metrics.avg || 0,
			]);
		}

		return rows.map((row) => row.join(',')).join('\n');
	}

	/**
	 * Get performance summary
	 */
	getPerformanceSummary() {
		const summary = {
			totalOperations: 0,
			averageDuration: 0,
			successRate: 0,
			errorRate: 0,
			throughput: 0,
		};

		let totalDuration = 0;
		let totalOperations = 0;
		let totalSuccessful = 0;
		let totalFailed = 0;

		for (const [key, metrics] of this.aggregatedMetrics) {
			totalOperations += metrics.count;

			if (metrics.durations) {
				totalDuration += metrics.durations.sum;
			}

			if (metrics.records) {
				totalSuccessful += metrics.records.successful;
				totalFailed += metrics.records.failed;
			}
		}

		summary.totalOperations = totalOperations;
		summary.averageDuration =
			totalOperations > 0 ? totalDuration / totalOperations : 0;
		summary.successRate =
			totalSuccessful + totalFailed > 0
				? totalSuccessful / (totalSuccessful + totalFailed)
				: 0;
		summary.errorRate = 1 - summary.successRate;
		summary.throughput =
			totalOperations > 0
				? totalOperations / (this.config.aggregationWindow / 1000)
				: 0;

		return summary;
	}

	/**
	 * Cleanup resources
	 */
	async cleanup() {
		try {
			logger.info('Cleaning up Metrics Collector...');

			this.stopPeriodicFlush();

			// Final flush before cleanup
			if (this.config.enabled) {
				this.flush();
			}

			this.metrics.clear();
			this.aggregatedMetrics.clear();
			this.removeAllListeners();

			this.initialized = false;
			logger.info('Metrics Collector cleanup completed');
		} catch (error) {
			logger.error('Metrics Collector cleanup failed:', error);
		}
	}
}

module.exports = { MetricsCollector };
