/**
 * Database Loader
 * Loads data into various database systems with optimization
 */

const BaseLoader = require('./base-loader');
const logger = require('../../utils/logger');

class DatabaseLoader extends BaseLoader {
	constructor(config = {}) {
		super(config);
		this.config = {
			...this.config,
			connectionString: config.connectionString,
			database: config.database,
			table: config.table,
			driver: config.driver || 'postgresql', // postgresql, mysql, mongodb
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
			bulkInsert: {
				enabled: config.bulkInsertEnabled !== false,
				batchSize: config.bulkBatchSize || 5000,
				timeout: config.bulkTimeout || 60000,
			},
			schema: {
				autoCreate: config.autoCreateSchema || false,
				fields: config.schemaFields || {},
			},
			optimization: {
				disableIndexes: config.disableIndexesDuringLoad || false,
				disableConstraints: config.disableConstraintsDuringLoad || false,
				vacuumAfterLoad: config.vacuumAfterLoad || false,
			},
		};

		this.connection = null;
		this.transaction = null;
	}

	/**
	 * Initialize the database loader
	 */
	async initializeLoader() {
		await this.setupConnection();
		await this.testConnection();

		if (this.config.schema.autoCreate) {
			await this.createTableIfNotExists();
		}

		// Optimize for bulk loading
		if (this.config.optimization.disableIndexes) {
			await this.disableIndexes();
		}

		if (this.config.optimization.disableConstraints) {
			await this.disableConstraints();
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
	 * Test database connection
	 */
	async testConnection() {
		try {
			switch (this.config.driver) {
				case 'postgresql':
					await this.connection.query('SELECT 1');
					break;

				case 'mysql':
					const client = await this.connection.getConnection();
					await client.query('SELECT 1');
					client.release();
					break;

				case 'mongodb':
					await this.connection.admin().ping();
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
	 * Load a single record
	 */
	async loadRecord(record) {
		try {
			switch (this.config.driver) {
				case 'postgresql':
				case 'mysql':
					return await this.loadSQLRecord(record);
				case 'mongodb':
					return await this.loadMongoRecord(record);
				default:
					throw new Error(
						`Unsupported driver for record loading: ${this.config.driver}`
					);
			}
		} catch (error) {
			logger.error('Failed to load record:', error);
			throw error;
		}
	}

	/**
	 * Load a chunk of records
	 */
	async loadChunk(records) {
		if (records.length === 0) {
			return { successful: 0, failed: 0, upserted: 0 };
		}

		try {
			if (this.config.bulkInsert.enabled && records.length >= 10) {
				return await this.bulkLoadRecords(records);
			} else {
				return await this.loadRecordsSequentially(records);
			}
		} catch (error) {
			logger.error(`Failed to load chunk of ${records.length} records:`, error);
			throw error;
		}
	}

	/**
	 * Bulk load records
	 */
	async bulkLoadRecords(records) {
		switch (this.config.driver) {
			case 'postgresql':
				return await this.bulkLoadPostgreSQL(records);
			case 'mysql':
				return await this.bulkLoadMySQL(records);
			case 'mongodb':
				return await this.bulkLoadMongoDB(records);
			default:
				throw new Error(`Bulk loading not supported for ${this.config.driver}`);
		}
	}

	/**
	 * Bulk load PostgreSQL records
	 */
	async bulkLoadPostgreSQL(records) {
		const client = await this.connection.connect();

		try {
			await client.query('BEGIN');

			if (this.config.upsert) {
				return await this.postgresUpsertRecords(client, records);
			} else {
				return await this.postgresInsertRecords(client, records);
			}
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			await client.query('COMMIT');
			client.release();
		}
	}

	/**
	 * PostgreSQL insert records
	 */
	async postgresInsertRecords(client, records) {
		const fields = Object.keys(records[0]);
		const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
		const query = `INSERT INTO ${this.config.table} (${fields.join(
			', '
		)}) VALUES (${placeholders})`;

		let successful = 0;
		let failed = 0;

		for (const record of records) {
			try {
				const values = fields.map((field) => record[field]);
				await client.query(query, values);
				successful++;
			} catch (error) {
				failed++;
				logger.error('Failed to insert record:', error);

				if (!this.config.continueOnError) {
					throw error;
				}
			}
		}

		return { successful, failed, upserted: 0 };
	}

	/**
	 * PostgreSQL upsert records
	 */
	async postgresUpsertRecords(client, records) {
		const fields = Object.keys(records[0]);
		const primaryKeyFields = Array.isArray(this.config.primaryKey)
			? this.config.primaryKey
			: [this.config.primaryKey];

		const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
		const updateSet = fields
			.filter((field) => !primaryKeyFields.includes(field))
			.map((field) => `${field} = EXCLUDED.${field}`)
			.join(', ');

		const conflictTarget = primaryKeyFields.join(', ');

		const query = `
            INSERT INTO ${this.config.table} (${fields.join(', ')}) 
            VALUES (${placeholders})
            ON CONFLICT (${conflictTarget}) 
            DO UPDATE SET ${updateSet}
            RETURNING xmax::text::int > 0 AS was_updated
        `;

		let successful = 0;
		let failed = 0;
		let upserted = 0;

		for (const record of records) {
			try {
				const values = fields.map((field) => record[field]);
				const result = await client.query(query, values);

				successful++;
				if (result.rows[0] && result.rows[0].was_updated) {
					upserted++;
				}
			} catch (error) {
				failed++;
				logger.error('Failed to upsert record:', error);

				if (!this.config.continueOnError) {
					throw error;
				}
			}
		}

		return { successful, failed, upserted };
	}

	/**
	 * Bulk load MySQL records
	 */
	async bulkLoadMySQL(records) {
		const connection = await this.connection.getConnection();

		try {
			await connection.beginTransaction();

			if (this.config.upsert) {
				return await this.mysqlUpsertRecords(connection, records);
			} else {
				return await this.mysqlInsertRecords(connection, records);
			}
		} catch (error) {
			await connection.rollback();
			throw error;
		} finally {
			await connection.commit();
			connection.release();
		}
	}

	/**
	 * MySQL insert records
	 */
	async mysqlInsertRecords(connection, records) {
		const fields = Object.keys(records[0]);
		const placeholders = fields.map(() => '?').join(', ');
		const query = `INSERT INTO ${this.config.table} (${fields.join(
			', '
		)}) VALUES (${placeholders})`;

		let successful = 0;
		let failed = 0;

		for (const record of records) {
			try {
				const values = fields.map((field) => record[field]);
				await connection.execute(query, values);
				successful++;
			} catch (error) {
				failed++;
				logger.error('Failed to insert record:', error);

				if (!this.config.continueOnError) {
					throw error;
				}
			}
		}

		return { successful, failed, upserted: 0 };
	}

	/**
	 * MySQL upsert records
	 */
	async mysqlUpsertRecords(connection, records) {
		const fields = Object.keys(records[0]);
		const placeholders = fields.map(() => '?').join(', ');
		const updateSet = fields
			.filter((field) => field !== this.config.primaryKey)
			.map((field) => `${field} = VALUES(${field})`)
			.join(', ');

		const query = `
            INSERT INTO ${this.config.table} (${fields.join(', ')}) 
            VALUES (${placeholders})
            ON DUPLICATE KEY UPDATE ${updateSet}
        `;

		let successful = 0;
		let failed = 0;

		for (const record of records) {
			try {
				const values = fields.map((field) => record[field]);
				const result = await connection.execute(query, values);
				successful++;
			} catch (error) {
				failed++;
				logger.error('Failed to upsert record:', error);

				if (!this.config.continueOnError) {
					throw error;
				}
			}
		}

		return { successful, failed, upserted: 0 }; // MySQL doesn't easily distinguish updates
	}

	/**
	 * Bulk load MongoDB records
	 */
	async bulkLoadMongoDB(records) {
		const collection = this.connection.collection(this.config.table);

		try {
			if (this.config.upsert) {
				return await this.mongoBulkUpsert(collection, records);
			} else {
				return await this.mongoBulkInsert(collection, records);
			}
		} catch (error) {
			logger.error('MongoDB bulk operation failed:', error);
			throw error;
		}
	}

	/**
	 * MongoDB bulk insert
	 */
	async mongoBulkInsert(collection, records) {
		try {
			const result = await collection.insertMany(records, {
				ordered: false,
				writeConcern: { w: 1 },
			});

			return {
				successful: result.insertedCount,
				failed: records.length - result.insertedCount,
				upserted: 0,
			};
		} catch (error) {
			if (error.code === 11000) {
				// Duplicate key error
				// Handle partial success
				const successful = error.result ? error.result.nInserted : 0;
				return {
					successful,
					failed: records.length - successful,
					upserted: 0,
				};
			}
			throw error;
		}
	}

	/**
	 * MongoDB bulk upsert
	 */
	async mongoBulkUpsert(collection, records) {
		const bulkOps = records.map((record) => {
			const filter = {};

			if (Array.isArray(this.config.primaryKey)) {
				for (const key of this.config.primaryKey) {
					filter[key] = record[key];
				}
			} else {
				filter[this.config.primaryKey] = record[this.config.primaryKey];
			}

			return {
				replaceOne: {
					filter,
					replacement: record,
					upsert: true,
				},
			};
		});

		const result = await collection.bulkWrite(bulkOps, { ordered: false });

		return {
			successful: result.upsertedCount + result.modifiedCount,
			failed: records.length - (result.upsertedCount + result.modifiedCount),
			upserted: result.upsertedCount,
		};
	}

	/**
	 * Load records sequentially
	 */
	async loadRecordsSequentially(records) {
		let successful = 0;
		let failed = 0;
		let upserted = 0;

		for (const record of records) {
			try {
				const result = await this.loadRecord(record);
				successful++;

				if (result && result.upserted) {
					upserted++;
				}
			} catch (error) {
				failed++;
				logger.error('Failed to load record:', error);

				if (!this.config.continueOnError) {
					throw error;
				}
			}
		}

		return { successful, failed, upserted };
	}

	/**
	 * Load SQL record
	 */
	async loadSQLRecord(record) {
		const fields = Object.keys(record);
		const values = fields.map((field) => record[field]);

		if (this.config.upsert) {
			return await this.upsertSQLRecord(fields, values);
		} else {
			return await this.insertSQLRecord(fields, values);
		}
	}

	/**
	 * Insert SQL record
	 */
	async insertSQLRecord(fields, values) {
		const placeholders =
			this.config.driver === 'postgresql'
				? fields.map((_, i) => `$${i + 1}`).join(', ')
				: fields.map(() => '?').join(', ');

		const query = `INSERT INTO ${this.config.table} (${fields.join(
			', '
		)}) VALUES (${placeholders})`;

		if (this.config.driver === 'postgresql') {
			await this.connection.query(query, values);
		} else {
			await this.connection.execute(query, values);
		}

		return { inserted: true };
	}

	/**
	 * Upsert SQL record
	 */
	async upsertSQLRecord(fields, values) {
		// Implementation varies by database
		if (this.config.driver === 'postgresql') {
			return await this.postgresUpsertRecord(fields, values);
		} else if (this.config.driver === 'mysql') {
			return await this.mysqlUpsertRecord(fields, values);
		}
	}

	/**
	 * PostgreSQL upsert operation
	 */
	async postgresUpsertRecord(fields, values) {
		const fieldNames = fields.join(', ');
		const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
		const updateSet = fields
			.map((field, i) => `${field} = $${i + 1}`)
			.join(', ');
		const primaryKeys = this.config.primaryKeys || ['id'];

		const query = `
			INSERT INTO ${this.config.table} (${fieldNames})
			VALUES (${placeholders})
			ON CONFLICT (${primaryKeys.join(', ')})
			DO UPDATE SET ${updateSet}
		`;

		await this.connection.query(query, values);
		return { upserted: true };
	}

	/**
	 * MySQL upsert operation
	 */
	async mysqlUpsertRecord(fields, values) {
		const fieldNames = fields.join(', ');
		const placeholders = fields.map(() => '?').join(', ');
		const updateSet = fields
			.map((field) => `${field} = VALUES(${field})`)
			.join(', ');

		const query = `
			INSERT INTO ${this.config.table} (${fieldNames})
			VALUES (${placeholders})
			ON DUPLICATE KEY UPDATE ${updateSet}
		`;

		await this.connection.execute(query, values);
		return { upserted: true };
	}

	/**
	 * Load MongoDB record
	 */
	async loadMongoRecord(record) {
		const collection = this.connection.collection(this.config.table);

		if (this.config.upsert) {
			const filter = {};

			if (Array.isArray(this.config.primaryKey)) {
				for (const key of this.config.primaryKey) {
					filter[key] = record[key];
				}
			} else {
				filter[this.config.primaryKey] = record[this.config.primaryKey];
			}

			const result = await collection.replaceOne(filter, record, {
				upsert: true,
			});
			return { upserted: result.upsertedCount > 0 };
		} else {
			await collection.insertOne(record);
			return { inserted: true };
		}
	}

	/**
	 * Check existing records
	 */
	async checkExistingRecords(records) {
		if (!this.config.primaryKey) {
			return [];
		}

		const keys = records.map((record) => this.getPrimaryKeyValue(record));

		switch (this.config.driver) {
			case 'postgresql':
			case 'mysql':
				return await this.checkExistingSQLRecords(keys);
			case 'mongodb':
				return await this.checkExistingMongoRecords(keys);
			default:
				return [];
		}
	}

	/**
	 * Check existing SQL records
	 */
	async checkExistingSQLRecords(keys) {
		const keyField = Array.isArray(this.config.primaryKey)
			? this.config.primaryKey[0]
			: this.config.primaryKey;

		const placeholders =
			this.config.driver === 'postgresql'
				? keys.map((_, i) => `$${i + 1}`).join(', ')
				: keys.map(() => '?').join(', ');

		const query = `SELECT ${keyField} FROM ${this.config.table} WHERE ${keyField} IN (${placeholders})`;

		const result =
			this.config.driver === 'postgresql'
				? await this.connection.query(query, keys)
				: await this.connection.execute(query, keys);

		return result.rows || result[0] || [];
	}

	/**
	 * Check existing MongoDB records
	 */
	async checkExistingMongoRecords(keys) {
		const collection = this.connection.collection(this.config.table);
		const keyField = Array.isArray(this.config.primaryKey)
			? this.config.primaryKey[0]
			: this.config.primaryKey;

		return await collection
			.find({
				[keyField]: { $in: keys },
			})
			.toArray();
	}

	/**
	 * Create table if it doesn't exist
	 */
	async createTableIfNotExists() {
		if (this.config.driver === 'mongodb') {
			// MongoDB creates collections automatically
			return;
		}

		const createTableQuery = this.buildCreateTableQuery();

		try {
			if (this.config.driver === 'postgresql') {
				await this.connection.query(createTableQuery);
			} else {
				await this.connection.execute(createTableQuery);
			}

			logger.info(`Table ${this.config.table} created successfully`);
		} catch (error) {
			if (error.code === '42P07' || error.code === 'ER_TABLE_EXISTS_ERROR') {
				// Table already exists
				logger.info(`Table ${this.config.table} already exists`);
			} else {
				throw error;
			}
		}
	}

	/**
	 * Build CREATE TABLE query
	 */
	buildCreateTableQuery() {
		const fields = Object.entries(this.config.schema.fields)
			.map(([name, type]) => `${name} ${type}`)
			.join(', ');

		let query = `CREATE TABLE IF NOT EXISTS ${this.config.table} (${fields}`;

		if (this.config.primaryKey) {
			const pkFields = Array.isArray(this.config.primaryKey)
				? this.config.primaryKey.join(', ')
				: this.config.primaryKey;
			query += `, PRIMARY KEY (${pkFields})`;
		}

		query += ')';
		return query;
	}

	/**
	 * Create index
	 */
	async createIndex(indexConfig) {
		const { name, fields, unique = false, type = 'btree' } = indexConfig;

		switch (this.config.driver) {
			case 'postgresql':
				await this.createPostgreSQLIndex(name, fields, unique, type);
				break;
			case 'mysql':
				await this.createMySQLIndex(name, fields, unique);
				break;
			case 'mongodb':
				await this.createMongoDBIndex(fields, unique);
				break;
		}
	}

	/**
	 * Create PostgreSQL index
	 */
	async createPostgreSQLIndex(name, fields, unique, type) {
		const fieldList = Array.isArray(fields) ? fields.join(', ') : fields;
		const uniqueKeyword = unique ? 'UNIQUE' : '';
		const indexName =
			name ||
			`idx_${this.config.table}_${fieldList.replace(/[^a-zA-Z0-9]/g, '_')}`;

		const query = `CREATE ${uniqueKeyword} INDEX CONCURRENTLY IF NOT EXISTS ${indexName} ON ${this.config.table} USING ${type} (${fieldList})`;

		await this.connection.query(query);
	}

	/**
	 * Create MySQL index
	 */
	async createMySQLIndex(name, fields, unique) {
		const fieldList = Array.isArray(fields) ? fields.join(', ') : fields;
		const uniqueKeyword = unique ? 'UNIQUE' : '';
		const indexName =
			name ||
			`idx_${this.config.table}_${fieldList.replace(/[^a-zA-Z0-9]/g, '_')}`;

		const query = `CREATE ${uniqueKeyword} INDEX ${indexName} ON ${this.config.table} (${fieldList})`;

		await this.connection.execute(query);
	}

	/**
	 * Create MongoDB index
	 */
	async createMongoDBIndex(fields, unique) {
		const collection = this.connection.collection(this.config.table);
		const indexSpec = {};

		if (Array.isArray(fields)) {
			for (const field of fields) {
				indexSpec[field] = 1;
			}
		} else {
			indexSpec[fields] = 1;
		}

		await collection.createIndex(indexSpec, { unique });
	}

	/**
	 * Disable indexes during bulk loading
	 */
	async disableIndexes() {
		// Implementation varies by database
		logger.info('Disabling indexes for bulk loading...');
	}

	/**
	 * Disable constraints during bulk loading
	 */
	async disableConstraints() {
		// Implementation varies by database
		logger.info('Disabling constraints for bulk loading...');
	}

	/**
	 * Re-enable indexes after loading
	 */
	async enableIndexes() {
		// Implementation varies by database
		logger.info('Re-enabling indexes after bulk loading...');
	}

	/**
	 * Re-enable constraints after loading
	 */
	async enableConstraints() {
		// Implementation varies by database
		logger.info('Re-enabling constraints after bulk loading...');
	}

	/**
	 * Perform archival
	 */
	async performArchival(cutoffDate) {
		const timestampField =
			this.config.versioning.timestampField || 'created_at';
		let archivedCount = 0;

		switch (this.config.driver) {
			case 'postgresql':
			case 'mysql':
				const query = `DELETE FROM ${this.config.table} WHERE ${timestampField} < ?`;
				const result =
					this.config.driver === 'postgresql'
						? await this.connection.query(query, [cutoffDate])
						: await this.connection.execute(query, [cutoffDate]);
				archivedCount = result.rowCount || result.affectedRows || 0;
				break;

			case 'mongodb':
				const collection = this.connection.collection(this.config.table);
				const deleteResult = await collection.deleteMany({
					[timestampField]: { $lt: cutoffDate },
				});
				archivedCount = deleteResult.deletedCount;
				break;
		}

		return archivedCount;
	}

	/**
	 * Clean up resources
	 */
	async cleanupLoader() {
		// Re-enable optimizations that were disabled
		if (this.config.optimization.disableIndexes) {
			await this.enableIndexes();
		}

		if (this.config.optimization.disableConstraints) {
			await this.enableConstraints();
		}

		// Vacuum/optimize tables after loading
		if (this.config.optimization.vacuumAfterLoad) {
			await this.vacuumTable();
		}

		// Close database connection
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
				}

				logger.info(`${this.config.driver} connection closed`);
			} catch (error) {
				logger.error(`Error closing ${this.config.driver} connection:`, error);
			}
		}
	}

	/**
	 * Vacuum/optimize table
	 */
	async vacuumTable() {
		try {
			switch (this.config.driver) {
				case 'postgresql':
					await this.connection.query(`VACUUM ANALYZE ${this.config.table}`);
					break;
				case 'mysql':
					await this.connection.execute(`OPTIMIZE TABLE ${this.config.table}`);
					break;
				// MongoDB doesn't need explicit vacuuming
			}

			logger.info(`Table ${this.config.table} optimized`);
		} catch (error) {
			logger.error('Table optimization failed:', error);
		}
	}
}

module.exports = DatabaseLoader;
