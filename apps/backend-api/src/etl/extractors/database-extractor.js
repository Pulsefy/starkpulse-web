/**
 * Database Extractor
 * Extracts data from various databases with optimized querying
 */

const BaseExtractor = require('./base-extractor');
const logger = require('../../utils/logger');

class DatabaseExtractor extends BaseExtractor {
	constructor(config = {}) {
		super(config);
		this.config = {
			...this.config,
			connectionString: config.connectionString,
			database: config.database,
			query: config.query,
			table: config.table,
			columns: config.columns || '*',
			whereClause: config.whereClause,
			orderBy: config.orderBy,
			driver: config.driver || 'postgresql', // postgresql, mysql, mongodb, redis
			connection: {
				pool: {
					min: config.poolMin || 2,
					max: config.poolMax || 10,
					idleTimeoutMillis: config.idleTimeout || 30000,
					connectionTimeoutMillis: config.connectionTimeout || 10000,
				},
				ssl: config.sslEnabled || false,
				...config.connectionOptions,
			},
			streaming: {
				enabled: config.streamingEnabled || false,
				highWaterMark: config.highWaterMark || 16384,
			},
			optimization: {
				useIndex: config.useIndex !== false,
				parallelQueries: config.parallelQueries || 1,
				fetchSize: config.fetchSize || 1000,
			},
		};

		this.connection = null;
		this.totalRecords = null;
	}

	/**
	 * Initialize the database extractor
	 */
	async initializeExtractor() {
		await this.setupConnection();
		await this.testConnection();

		if (this.config.table) {
			await this.optimizeQuery();
		}
	}

	/**
	 * Setup database connection
	 */
	async setupConnection() {
		switch (this.config.driver) {
			case 'postgresql':
				await this.setupPostgreSQLConnection();
				break;
			case 'mysql':
				await this.setupMySQLConnection();
				break;
			case 'mongodb':
				await this.setupMongoDBConnection();
				break;
			case 'redis':
				await this.setupRedisConnection();
				break;
			default:
				throw new Error(`Unsupported database driver: ${this.config.driver}`);
		}
	}

	/**
	 * Setup PostgreSQL connection
	 */
	async setupPostgreSQLConnection() {
		const { Pool } = require('pg');

		this.connection = new Pool({
			connectionString: this.config.connectionString,
			min: this.config.connection.pool.min,
			max: this.config.connection.pool.max,
			idleTimeoutMillis: this.config.connection.pool.idleTimeoutMillis,
			connectionTimeoutMillis:
				this.config.connection.pool.connectionTimeoutMillis,
			ssl: this.config.connection.ssl,
		});

		// Handle connection errors
		this.connection.on('error', (err) => {
			logger.error('PostgreSQL connection error:', err);
		});
	}

	/**
	 * Setup MySQL connection
	 */
	async setupMySQLConnection() {
		const mysql = require('mysql2/promise');

		this.connection = mysql.createPool({
			uri: this.config.connectionString,
			connectionLimit: this.config.connection.pool.max,
			acquireTimeout: this.config.connection.pool.connectionTimeoutMillis,
			timeout: this.config.connection.pool.idleTimeoutMillis,
			ssl: this.config.connection.ssl,
		});
	}

	/**
	 * Setup MongoDB connection
	 */
	async setupMongoDBConnection() {
		const { MongoClient } = require('mongodb');

		const client = new MongoClient(this.config.connectionString, {
			maxPoolSize: this.config.connection.pool.max,
			minPoolSize: this.config.connection.pool.min,
			maxIdleTimeMS: this.config.connection.pool.idleTimeoutMillis,
			serverSelectionTimeoutMS:
				this.config.connection.pool.connectionTimeoutMillis,
		});

		await client.connect();
		this.connection = client.db(this.config.database);
	}

	/**
	 * Setup Redis connection
	 */
	async setupRedisConnection() {
		const Redis = require('ioredis');

		this.connection = new Redis(this.config.connectionString, {
			retryDelayOnFailover: 100,
			enableReadyCheck: false,
			maxRetriesPerRequest: 3,
		});
	}

	/**
	 * Test database connection
	 */
	async testConnection() {
		try {
			switch (this.config.driver) {
				case 'postgresql':
				case 'mysql':
					const client = await this.connection.getConnection();
					await client.query('SELECT 1');
					client.release();
					break;

				case 'mongodb':
					await this.connection.admin().ping();
					break;

				case 'redis':
					await this.connection.ping();
					break;
			}

			logger.info(`${this.config.driver} connection test successful`);
		} catch (error) {
			logger.error(`${this.config.driver} connection test failed:`, error);
			throw new Error(
				`Failed to connect to ${this.config.driver}: ${error.message}`
			);
		}
	}

	/**
	 * Optimize query performance
	 */
	async optimizeQuery() {
		if (!this.config.optimization.useIndex) return;

		try {
			switch (this.config.driver) {
				case 'postgresql':
					await this.optimizePostgreSQLQuery();
					break;
				case 'mysql':
					await this.optimizeMySQLQuery();
					break;
				case 'mongodb':
					await this.optimizeMongoDBQuery();
					break;
			}
		} catch (error) {
			logger.warn('Query optimization failed:', error.message);
			// Continue without optimization
		}
	}

	/**
	 * Optimize PostgreSQL query
	 */
	async optimizePostgreSQLQuery() {
		const explainQuery = this.buildExplainQuery();
		const result = await this.connection.query(explainQuery);

		logger.debug('PostgreSQL query plan:', result.rows);

		// Check if index is being used
		const planText = JSON.stringify(result.rows);
		if (planText.includes('Seq Scan') && !planText.includes('Index Scan')) {
			logger.warn('Query may benefit from an index');
		}
	}

	/**
	 * Optimize MySQL query
	 */
	async optimizeMySQLQuery() {
		const explainQuery = this.buildExplainQuery();
		const [rows] = await this.connection.execute(explainQuery);

		logger.debug('MySQL query plan:', rows);

		// Check for full table scan
		if (rows.some((row) => row.type === 'ALL')) {
			logger.warn('Query performing full table scan - consider adding index');
		}
	}

	/**
	 * Optimize MongoDB query
	 */
	async optimizeMongoDBQuery() {
		const collection = this.connection.collection(this.config.table);
		const query = this.buildMongoQuery();

		const explain = await collection.find(query).explain('executionStats');
		logger.debug('MongoDB query plan:', explain);

		if (explain.executionStats.executionStages.stage === 'COLLSCAN') {
			logger.warn(
				'MongoDB query performing collection scan - consider adding index'
			);
		}
	}

	/**
	 * Get total count of records
	 */
	async getTotalCount() {
		if (this.totalRecords !== null) {
			return this.totalRecords;
		}

		try {
			switch (this.config.driver) {
				case 'postgresql':
				case 'mysql':
					this.totalRecords = await this.getSQLTotalCount();
					break;
				case 'mongodb':
					this.totalRecords = await this.getMongoTotalCount();
					break;
				case 'redis':
					this.totalRecords = await this.getRedisTotalCount();
					break;
			}

			return this.totalRecords;
		} catch (error) {
			logger.warn('Failed to get total count:', error.message);
			return null;
		}
	}

	/**
	 * Get SQL total count
	 */
	async getSQLTotalCount() {
		const countQuery = this.buildCountQuery();
		const result =
			this.config.driver === 'postgresql'
				? await this.connection.query(countQuery)
				: await this.connection.execute(countQuery);

		const rows = result.rows || result[0];
		return parseInt(rows[0].count);
	}

	/**
	 * Get MongoDB total count
	 */
	async getMongoTotalCount() {
		const collection = this.connection.collection(this.config.table);
		const query = this.buildMongoQuery();
		return await collection.countDocuments(query);
	}

	/**
	 * Get Redis total count
	 */
	async getRedisTotalCount() {
		// For Redis, this depends on the data structure
		if (this.config.query.type === 'keys') {
			const keys = await this.connection.keys(this.config.query.pattern);
			return keys.length;
		} else if (this.config.query.type === 'scan') {
			let count = 0;
			const stream = this.connection.scanStream({
				match: this.config.query.pattern,
				count: 100,
			});

			return new Promise((resolve, reject) => {
				stream.on('data', (keys) => {
					count += keys.length;
				});
				stream.on('end', () => resolve(count));
				stream.on('error', reject);
			});
		}

		return null;
	}

	/**
	 * Extract a batch of records
	 */
	async extractBatch(offset, limit) {
		try {
			switch (this.config.driver) {
				case 'postgresql':
				case 'mysql':
					return await this.extractSQLBatch(offset, limit);
				case 'mongodb':
					return await this.extractMongoBatch(offset, limit);
				case 'redis':
					return await this.extractRedisBatch(offset, limit);
				default:
					throw new Error(
						`Unsupported driver for batch extraction: ${this.config.driver}`
					);
			}
		} catch (error) {
			logger.error(
				`Failed to extract batch (offset: ${offset}, limit: ${limit}):`,
				error
			);
			throw error;
		}
	}

	/**
	 * Extract SQL batch
	 */
	async extractSQLBatch(offset, limit) {
		const query = this.config.query || this.buildSelectQuery(offset, limit);

		const result =
			this.config.driver === 'postgresql'
				? await this.connection.query(query)
				: await this.connection.execute(query);

		return result.rows || result[0];
	}

	/**
	 * Extract MongoDB batch
	 */
	async extractMongoBatch(offset, limit) {
		const collection = this.connection.collection(this.config.table);
		const query = this.buildMongoQuery();

		const cursor = collection.find(query).skip(offset).limit(limit);

		if (this.config.orderBy) {
			cursor.sort(this.config.orderBy);
		}

		return await cursor.toArray();
	}

	/**
	 * Extract Redis batch
	 */
	async extractRedisBatch(offset, limit) {
		if (this.config.query.type === 'keys') {
			const keys = await this.connection.keys(this.config.query.pattern);
			const batchKeys = keys.slice(offset, offset + limit);

			if (batchKeys.length === 0) return [];

			// Get values for keys
			const values = await this.connection.mget(batchKeys);
			return batchKeys.map((key, index) => ({
				key,
				value: values[index] ? JSON.parse(values[index]) : null,
			}));
		}

		// For other Redis operations, implement as needed
		return [];
	}

	/**
	 * Build SELECT query
	 */
	buildSelectQuery(offset, limit) {
		let query = `SELECT ${this.config.columns} FROM ${this.config.table}`;

		if (this.config.whereClause) {
			query += ` WHERE ${this.config.whereClause}`;
		}

		if (this.config.orderBy) {
			query += ` ORDER BY ${this.config.orderBy}`;
		}

		query += ` LIMIT ${limit} OFFSET ${offset}`;

		return query;
	}

	/**
	 * Build COUNT query
	 */
	buildCountQuery() {
		let query = `SELECT COUNT(*) as count FROM ${this.config.table}`;

		if (this.config.whereClause) {
			query += ` WHERE ${this.config.whereClause}`;
		}

		return query;
	}

	/**
	 * Build EXPLAIN query
	 */
	buildExplainQuery() {
		const selectQuery = this.buildSelectQuery(0, 1);
		return this.config.driver === 'postgresql'
			? `EXPLAIN (FORMAT JSON) ${selectQuery}`
			: `EXPLAIN ${selectQuery}`;
	}

	/**
	 * Build MongoDB query
	 */
	buildMongoQuery() {
		if (this.config.query && typeof this.config.query === 'object') {
			return this.config.query;
		}

		// Build query from whereClause if provided
		if (this.config.whereClause) {
			try {
				return JSON.parse(this.config.whereClause);
			} catch {
				logger.warn('Invalid MongoDB query, using empty query');
				return {};
			}
		}

		return {};
	}

	/**
	 * Clean up resources
	 */
	async cleanup() {
		await super.cleanup();

		if (this.connection) {
			try {
				switch (this.config.driver) {
					case 'postgresql':
					case 'mysql':
						await this.connection.end();
						break;
					case 'mongodb':
						await this.connection.client.close();
						break;
					case 'redis':
						await this.connection.quit();
						break;
				}

				logger.info(`${this.config.driver} connection closed`);
			} catch (error) {
				logger.error(`Error closing ${this.config.driver} connection:`, error);
			}
		}
	}
}

module.exports = DatabaseExtractor;
