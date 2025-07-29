/**
 * State Manager
 * Manages pipeline state, checkpoints, and execution history
 */

const EventEmitter = require('eventemitter3');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

class StateManager extends EventEmitter {
	constructor(config = {}) {
		super();
		this.config = {
			storage: {
				type: config.storageType || 'redis', // redis, mongodb, filesystem
				connectionString: config.connectionString,
				keyPrefix: config.keyPrefix || 'etl:state',
				ttl: config.ttl || 7 * 24 * 60 * 60 * 1000, // 7 days
			},
			checkpoints: {
				enabled: config.checkpointsEnabled !== false,
				compression: config.compressionEnabled !== false,
				maxSize: config.maxCheckpointSize || 100 * 1024 * 1024, // 100MB
				retention: config.checkpointRetention || 24 * 60 * 60 * 1000, // 24 hours
			},
			history: {
				maxExecutions: config.maxExecutions || 1000,
				retention: config.historyRetention || 30 * 24 * 60 * 60 * 1000, // 30 days
			},
			...config,
		};

		this.storage = null;
		this.executionHistory = new Map();
		this.checkpoints = new Map();
		this.initialized = false;
	}

	/**
	 * Initialize state manager
	 */
	async initialize() {
		try {
			logger.info('Initializing State Manager...');

			// Initialize storage backend
			await this.initializeStorage();

			// Load existing state
			await this.loadState();

			// Start cleanup tasks
			this.startCleanupTasks();

			this.initialized = true;
			this.emit('initialized');

			logger.info('State Manager initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize State Manager:', error);
			throw error;
		}
	}

	/**
	 * Initialize storage backend
	 */
	async initializeStorage() {
		const { type, connectionString } = this.config.storage;

		switch (type) {
			case 'redis':
				this.storage = await this.initializeRedisStorage(connectionString);
				break;
			case 'mongodb':
				this.storage = await this.initializeMongoStorage(connectionString);
				break;
			case 'filesystem':
				this.storage = await this.initializeFileStorage(connectionString);
				break;
			default:
				throw new Error(`Unsupported storage type: ${type}`);
		}
	}

	/**
	 * Initialize Redis storage
	 */
	async initializeRedisStorage(connectionString) {
		const Redis = require('ioredis');
		const redis = new Redis(connectionString || process.env.REDIS_URL);

		await redis.ping();
		logger.info('Connected to Redis for state management');

		return {
			async get(key) {
				const value = await redis.get(key);
				return value ? JSON.parse(value) : null;
			},

			async set(key, value, ttl) {
				const serialized = JSON.stringify(value);
				if (ttl) {
					await redis.setex(key, Math.floor(ttl / 1000), serialized);
				} else {
					await redis.set(key, serialized);
				}
			},

			async del(key) {
				await redis.del(key);
			},

			async keys(pattern) {
				return await redis.keys(pattern);
			},

			async exists(key) {
				return (await redis.exists(key)) === 1;
			},

			async close() {
				await redis.quit();
			},
		};
	}

	/**
	 * Initialize MongoDB storage
	 */
	async initializeMongoStorage(connectionString) {
		const { MongoClient } = require('mongodb');
		const client = new MongoClient(connectionString);

		await client.connect();
		const db = client.db('etl_state');
		const collection = db.collection('states');

		logger.info('Connected to MongoDB for state management');

		return {
			async get(key) {
				const doc = await collection.findOne({ _id: key });
				return doc ? doc.value : null;
			},

			async set(key, value, ttl) {
				const doc = { _id: key, value };
				if (ttl) {
					doc.expiresAt = new Date(Date.now() + ttl);
				}
				await collection.replaceOne({ _id: key }, doc, { upsert: true });
			},

			async del(key) {
				await collection.deleteOne({ _id: key });
			},

			async keys(pattern) {
				const regex = new RegExp(pattern.replace(/\*/g, '.*'));
				const docs = await collection.find({ _id: regex }).toArray();
				return docs.map((doc) => doc._id);
			},

			async exists(key) {
				const count = await collection.countDocuments({ _id: key });
				return count > 0;
			},

			async close() {
				await client.close();
			},
		};
	}

	/**
	 * Initialize filesystem storage
	 */
	async initializeFileStorage(basePath) {
		const fs = require('fs').promises;
		const path = require('path');
		const crypto = require('crypto');

		const stateDir = basePath || path.join(process.cwd(), 'data', 'etl-state');
		await fs.mkdir(stateDir, { recursive: true });

		logger.info(`Using filesystem storage at: ${stateDir}`);

		return {
			async get(key) {
				try {
					const filePath = path.join(stateDir, this.hashKey(key));
					const data = await fs.readFile(filePath, 'utf8');
					return JSON.parse(data);
				} catch (error) {
					if (error.code === 'ENOENT') {
						return null;
					}
					throw error;
				}
			},

			async set(key, value) {
				const filePath = path.join(stateDir, this.hashKey(key));
				await fs.writeFile(filePath, JSON.stringify(value), 'utf8');
			},

			async del(key) {
				try {
					const filePath = path.join(stateDir, this.hashKey(key));
					await fs.unlink(filePath);
				} catch (error) {
					if (error.code !== 'ENOENT') {
						throw error;
					}
				}
			},

			async keys(pattern) {
				const files = await fs.readdir(stateDir);
				// Simple pattern matching - in production would use more sophisticated matching
				return files.filter((file) =>
					file.includes(pattern.replace(/\*/g, ''))
				);
			},

			async exists(key) {
				try {
					const filePath = path.join(stateDir, this.hashKey(key));
					await fs.access(filePath);
					return true;
				} catch {
					return false;
				}
			},

			async close() {
				// No cleanup needed for filesystem
			},

			hashKey(key) {
				return crypto.createHash('md5').update(key).digest('hex') + '.json';
			},
		};
	}

	/**
	 * Load existing state from storage
	 */
	async loadState() {
		try {
			// Load execution history
			const historyKeys = await this.storage.keys(
				`${this.config.storage.keyPrefix}:history:*`
			);
			for (const key of historyKeys) {
				const execution = await this.storage.get(key);
				if (execution) {
					this.executionHistory.set(execution.id, execution);
				}
			}

			// Load checkpoints metadata
			const checkpointKeys = await this.storage.keys(
				`${this.config.storage.keyPrefix}:checkpoint:*`
			);
			for (const key of checkpointKeys.slice(0, 100)) {
				// Limit initial load
				const checkpoint = await this.storage.get(key);
				if (checkpoint) {
					this.checkpoints.set(checkpoint.id, checkpoint);
				}
			}

			logger.info(
				`Loaded ${this.executionHistory.size} executions and ${this.checkpoints.size} checkpoints from storage`
			);
		} catch (error) {
			logger.error('Failed to load state from storage:', error);
			// Continue initialization even if state loading fails
		}
	}

	/**
	 * Save pipeline execution
	 */
	async saveExecution(execution) {
		const key = `${this.config.storage.keyPrefix}:history:${execution.id}`;

		try {
			await this.storage.set(key, execution, this.config.history.retention);
			this.executionHistory.set(execution.id, execution);

			// Maintain size limit
			if (this.executionHistory.size > this.config.history.maxExecutions) {
				const oldestId = this.executionHistory.keys().next().value;
				await this.deleteExecution(oldestId);
			}

			this.emit('executionSaved', execution);
		} catch (error) {
			logger.error(`Failed to save execution ${execution.id}:`, error);
			throw error;
		}
	}

	/**
	 * Get pipeline execution
	 */
	async getExecution(executionId) {
		// Try memory first
		if (this.executionHistory.has(executionId)) {
			return this.executionHistory.get(executionId);
		}

		// Try storage
		const key = `${this.config.storage.keyPrefix}:history:${executionId}`;
		const execution = await this.storage.get(key);

		if (execution) {
			this.executionHistory.set(executionId, execution);
		}

		return execution;
	}

	/**
	 * Get last execution for pipeline
	 */
	async getLastExecution(pipelineId) {
		const executions = Array.from(this.executionHistory.values())
			.filter((exec) => exec.pipelineId === pipelineId)
			.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

		return executions.length > 0 ? executions[0] : null;
	}

	/**
	 * Get pipeline execution history
	 */
	async getExecutionHistory(pipelineId, limit = 10) {
		const executions = Array.from(this.executionHistory.values())
			.filter((exec) => exec.pipelineId === pipelineId)
			.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
			.slice(0, limit);

		return executions;
	}

	/**
	 * Delete execution
	 */
	async deleteExecution(executionId) {
		const key = `${this.config.storage.keyPrefix}:history:${executionId}`;

		try {
			await this.storage.del(key);
			this.executionHistory.delete(executionId);

			this.emit('executionDeleted', executionId);
		} catch (error) {
			logger.error(`Failed to delete execution ${executionId}:`, error);
		}
	}

	/**
	 * Save checkpoint
	 */
	async saveCheckpoint(checkpoint, data) {
		if (!this.config.checkpoints.enabled) {
			return;
		}

		try {
			// Compress data if enabled
			const processedData = this.config.checkpoints.compression
				? await this.compressData(data)
				: data;

			// Check size limit
			const dataSize = this.calculateDataSize(processedData);
			if (dataSize > this.config.checkpoints.maxSize) {
				logger.warn(
					`Checkpoint data too large (${dataSize} bytes), skipping save`
				);
				return;
			}

			const checkpointData = {
				...checkpoint,
				data: processedData,
				compressed: this.config.checkpoints.compression,
				dataSize,
			};

			const key = `${this.config.storage.keyPrefix}:checkpoint:${checkpoint.id}`;
			await this.storage.set(
				key,
				checkpointData,
				this.config.checkpoints.retention
			);

			this.checkpoints.set(checkpoint.id, { ...checkpointData, data: null }); // Store metadata only

			this.emit('checkpointSaved', checkpoint);

			logger.debug(`Saved checkpoint ${checkpoint.id} (${dataSize} bytes)`);
		} catch (error) {
			logger.error(`Failed to save checkpoint ${checkpoint.id}:`, error);
			throw error;
		}
	}

	/**
	 * Get checkpoint
	 */
	async getCheckpoint(checkpointId) {
		const key = `${this.config.storage.keyPrefix}:checkpoint:${checkpointId}`;
		const checkpoint = await this.storage.get(key);

		if (!checkpoint) {
			return null;
		}

		// Decompress data if needed
		if (checkpoint.compressed) {
			checkpoint.data = await this.decompressData(checkpoint.data);
		}

		return checkpoint;
	}

	/**
	 * Get checkpoints for execution
	 */
	async getExecutionCheckpoints(executionId) {
		const checkpoints = Array.from(this.checkpoints.values())
			.filter((cp) => cp.executionId === executionId)
			.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

		return checkpoints;
	}

	/**
	 * Delete checkpoint
	 */
	async deleteCheckpoint(checkpointId) {
		const key = `${this.config.storage.keyPrefix}:checkpoint:${checkpointId}`;

		try {
			await this.storage.del(key);
			this.checkpoints.delete(checkpointId);

			this.emit('checkpointDeleted', checkpointId);
		} catch (error) {
			logger.error(`Failed to delete checkpoint ${checkpointId}:`, error);
		}
	}

	/**
	 * Compress data
	 */
	async compressData(data) {
		const zlib = require('zlib');
		const { promisify } = require('util');
		const gzip = promisify(zlib.gzip);

		const jsonString = JSON.stringify(data);
		const compressed = await gzip(jsonString);

		return {
			type: 'gzip',
			data: compressed.toString('base64'),
			originalSize: jsonString.length,
			compressedSize: compressed.length,
		};
	}

	/**
	 * Decompress data
	 */
	async decompressData(compressedData) {
		if (!compressedData.type) {
			return compressedData; // Not compressed
		}

		const zlib = require('zlib');
		const { promisify } = require('util');
		const gunzip = promisify(zlib.gunzip);

		const buffer = Buffer.from(compressedData.data, 'base64');
		const decompressed = await gunzip(buffer);

		return JSON.parse(decompressed.toString());
	}

	/**
	 * Calculate data size
	 */
	calculateDataSize(data) {
		return Buffer.byteLength(JSON.stringify(data), 'utf8');
	}

	/**
	 * Start cleanup tasks
	 */
	startCleanupTasks() {
		// Clean up old executions every hour
		setInterval(async () => {
			try {
				await this.cleanupOldExecutions();
			} catch (error) {
				logger.error('Failed to cleanup old executions:', error);
			}
		}, 60 * 60 * 1000);

		// Clean up old checkpoints every 6 hours
		setInterval(async () => {
			try {
				await this.cleanupOldCheckpoints();
			} catch (error) {
				logger.error('Failed to cleanup old checkpoints:', error);
			}
		}, 6 * 60 * 60 * 1000);
	}

	/**
	 * Clean up old executions
	 */
	async cleanupOldExecutions() {
		const cutoff = new Date(Date.now() - this.config.history.retention);
		const executionsToDelete = [];

		for (const [id, execution] of this.executionHistory) {
			if (new Date(execution.startTime) < cutoff) {
				executionsToDelete.push(id);
			}
		}

		logger.info(`Cleaning up ${executionsToDelete.length} old executions`);

		for (const id of executionsToDelete) {
			await this.deleteExecution(id);
		}
	}

	/**
	 * Clean up old checkpoints
	 */
	async cleanupOldCheckpoints() {
		const cutoff = new Date(Date.now() - this.config.checkpoints.retention);
		const checkpointsToDelete = [];

		for (const [id, checkpoint] of this.checkpoints) {
			if (new Date(checkpoint.timestamp) < cutoff) {
				checkpointsToDelete.push(id);
			}
		}

		logger.info(`Cleaning up ${checkpointsToDelete.length} old checkpoints`);

		for (const id of checkpointsToDelete) {
			await this.deleteCheckpoint(id);
		}
	}

	/**
	 * Get state statistics
	 */
	getStateStats() {
		const totalExecutions = this.executionHistory.size;
		const totalCheckpoints = this.checkpoints.size;

		const executionsByStatus = {};
		const executionsByPipeline = {};

		for (const execution of this.executionHistory.values()) {
			executionsByStatus[execution.status] =
				(executionsByStatus[execution.status] || 0) + 1;
			executionsByPipeline[execution.pipelineId] =
				(executionsByPipeline[execution.pipelineId] || 0) + 1;
		}

		return {
			executions: {
				total: totalExecutions,
				byStatus: executionsByStatus,
				byPipeline: executionsByPipeline,
			},
			checkpoints: {
				total: totalCheckpoints,
			},
			storage: {
				type: this.config.storage.type,
				keyPrefix: this.config.storage.keyPrefix,
			},
		};
	}

	/**
	 * Health check
	 */
	async healthCheck() {
		try {
			// Test storage connectivity
			const testKey = `${this.config.storage.keyPrefix}:health:${Date.now()}`;
			const testValue = { test: true, timestamp: new Date() };

			await this.storage.set(testKey, testValue);
			const retrieved = await this.storage.get(testKey);
			await this.storage.del(testKey);

			if (!retrieved || retrieved.test !== true) {
				throw new Error('Storage read/write test failed');
			}

			return {
				status: 'healthy',
				storage: {
					type: this.config.storage.type,
					connected: true,
				},
				state: this.getStateStats(),
			};
		} catch (error) {
			return {
				status: 'unhealthy',
				error: error.message,
				storage: {
					type: this.config.storage.type,
					connected: false,
				},
			};
		}
	}

	/**
	 * Shutdown state manager
	 */
	async shutdown() {
		logger.info('Shutting down State Manager...');

		if (this.storage) {
			await this.storage.close();
		}

		this.emit('shutdown');
	}
}

module.exports = { StateManager };
