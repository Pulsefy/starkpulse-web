/**
 * Stream Loader
 * Loads data into streaming systems like Kafka, Redis Streams, and message queues
 */

const BaseLoader = require('./base-loader');
const logger = require('../../utils/logger');

class StreamLoader extends BaseLoader {
	constructor(config = {}) {
		super(config);
		this.config = {
			...this.config,
			streamType: config.streamType || 'stdout', // stdout, kafka, redis, rabbitmq, kinesis
			bufferSize: config.bufferSize || 1000,
			flushInterval: config.flushInterval || 5000,
			connection: {
				brokers: config.brokers || ['localhost:9092'],
				clientId: config.clientId || 'etl-stream-loader',
				connectionTimeout: config.connectionTimeout || 10000,
				requestTimeout: config.requestTimeout || 30000,
				...config.connectionOptions,
			},
			topic: config.topic || 'etl-data',
			partitioning: {
				strategy: config.partitionStrategy || 'round-robin', // round-robin, key-based, random
				key: config.partitionKey,
				partitions: config.partitions || 1,
			},
			serialization: {
				keySerializer: config.keySerializer || 'string',
				valueSerializer: config.valueSerializer || 'json',
			},
			delivery: {
				guarantees: config.deliveryGuarantees || 'at-least-once', // at-most-once, at-least-once, exactly-once
				compression: config.compression || 'gzip',
				batchSize: config.batchSize || 100,
				lingerMs: config.lingerMs || 100,
				maxInFlight: config.maxInFlight || 5,
			},
			retry: {
				retries: config.retries || 3,
				initialRetryTime: config.initialRetryTime || 100,
				maxRetryTime: config.maxRetryTime || 32 * 1000,
				factor: config.retryFactor || 0.2,
				multiplier: config.retryMultiplier || 2,
			},
		};

		this.producer = null;
		this.client = null;
		this.isConnected = false;
		this.messageBuffer = [];
		this.pendingMessages = new Map();
	}

	/**
	 * Initialize the stream loader
	 */
	async initializeLoader() {
		await this.setupConnection();
		await this.testConnection();

		// Initialize topic/stream if needed
		if (this.config.createTopic !== false) {
			await this.createTopicIfNotExists();
		}

		// Start background flush if batching is enabled
		if (this.config.delivery.batchSize > 1) {
			this.startBackgroundFlush();
		}

		logger.info(`Stream loader initialized for ${this.config.streamType}`);
	}

	/**
	 * Setup connection based on stream type
	 */
	async setupConnection() {
		switch (this.config.streamType) {
			case 'stdout':
				await this.setupStdoutConnection();
				break;
			case 'kafka':
				await this.setupKafkaConnection();
				break;
			case 'redis':
				await this.setupRedisConnection();
				break;
			case 'rabbitmq':
				await this.setupRabbitMQConnection();
				break;
			case 'kinesis':
				await this.setupKinesisConnection();
				break;
			default:
				throw new Error(`Unsupported stream type: ${this.config.streamType}`);
		}
	}

	/**
	 * Setup stdout connection
	 */
	async setupStdoutConnection() {
		// For stdout, we just use process.stdout
		this.client = process.stdout;
		this.isConnected = true;
		logger.debug('Stdout connection established');
	}

	/**
	 * Setup Kafka connection
	 */
	async setupKafkaConnection() {
		const { Kafka } = require('kafkajs');

		this.client = new Kafka({
			clientId: this.config.connection.clientId,
			brokers: this.config.connection.brokers,
			connectionTimeout: this.config.connection.connectionTimeout,
			requestTimeout: this.config.connection.requestTimeout,
			retry: {
				initialRetryTime: this.config.retry.initialRetryTime,
				retries: this.config.retry.retries,
			},
		});

		this.producer = this.client.producer({
			maxInFlightRequests: this.config.delivery.maxInFlight,
			idempotent: this.config.delivery.guarantees === 'exactly-once',
			transactionTimeout: 30000,
		});

		await this.producer.connect();
		this.isConnected = true;
	}

	/**
	 * Setup Redis connection
	 */
	async setupRedisConnection() {
		const Redis = require('ioredis');

		this.client = new Redis({
			host: this.config.connection.host || 'localhost',
			port: this.config.connection.port || 6379,
			password: this.config.connection.password,
			db: this.config.connection.db || 0,
			connectTimeout: this.config.connection.connectionTimeout,
			commandTimeout: this.config.connection.requestTimeout,
			retryDelayOnFailover: 100,
			maxRetriesPerRequest: this.config.retry.retries,
		});

		await this.client.ping();
		this.isConnected = true;
	}

	/**
	 * Setup RabbitMQ connection
	 */
	async setupRabbitMQConnection() {
		const amqp = require('amqplib');

		const connectionUrl = this.config.connection.url || 'amqp://localhost';
		this.client = await amqp.connect(connectionUrl);

		this.channel = await this.client.createChannel();
		await this.channel.prefetch(this.config.delivery.maxInFlight);

		this.isConnected = true;
	}

	/**
	 * Setup Kinesis connection
	 */
	async setupKinesisConnection() {
		const AWS = require('aws-sdk');

		this.client = new AWS.Kinesis({
			region: this.config.connection.region || 'us-east-1',
			accessKeyId: this.config.connection.accessKeyId,
			secretAccessKey: this.config.connection.secretAccessKey,
			httpOptions: {
				timeout: this.config.connection.requestTimeout,
			},
		});

		// Test connection
		await this.client.listStreams({ Limit: 1 }).promise();
		this.isConnected = true;
	}

	/**
	 * Test connection
	 */
	async testConnection() {
		if (!this.isConnected) {
			throw new Error(`${this.config.streamType} connection not established`);
		}

		logger.info(`${this.config.streamType} connection test successful`);
	}

	/**
	 * Create topic/stream if it doesn't exist
	 */
	async createTopicIfNotExists() {
		switch (this.config.streamType) {
			case 'kafka':
				await this.createKafkaTopic();
				break;
			case 'redis':
				// Redis streams are created automatically
				break;
			case 'rabbitmq':
				await this.createRabbitMQQueue();
				break;
			case 'kinesis':
				await this.createKinesisStream();
				break;
		}
	}

	/**
	 * Create Kafka topic
	 */
	async createKafkaTopic() {
		try {
			const admin = this.client.admin();
			await admin.connect();

			const existingTopics = await admin.listTopics();

			if (!existingTopics.includes(this.config.topic)) {
				await admin.createTopics({
					topics: [
						{
							topic: this.config.topic,
							numPartitions: this.config.partitioning.partitions,
							replicationFactor: this.config.replicationFactor || 1,
						},
					],
				});

				logger.info(`Created Kafka topic: ${this.config.topic}`);
			}

			await admin.disconnect();
		} catch (error) {
			logger.error('Failed to create Kafka topic:', error);
			throw error;
		}
	}

	/**
	 * Create RabbitMQ queue
	 */
	async createRabbitMQQueue() {
		try {
			await this.channel.assertQueue(this.config.topic, {
				durable: true,
				maxLength: this.config.maxQueueLength,
			});

			logger.info(`Created RabbitMQ queue: ${this.config.topic}`);
		} catch (error) {
			logger.error('Failed to create RabbitMQ queue:', error);
			throw error;
		}
	}

	/**
	 * Create Kinesis stream
	 */
	async createKinesisStream() {
		try {
			const streams = await this.client.listStreams().promise();

			if (!streams.StreamNames.includes(this.config.topic)) {
				await this.client
					.createStream({
						StreamName: this.config.topic,
						ShardCount: this.config.partitioning.partitions,
					})
					.promise();

				// Wait for stream to become active
				await this.waitForKinesisStreamActive();

				logger.info(`Created Kinesis stream: ${this.config.topic}`);
			}
		} catch (error) {
			logger.error('Failed to create Kinesis stream:', error);
			throw error;
		}
	}

	/**
	 * Wait for Kinesis stream to become active
	 */
	async waitForKinesisStreamActive() {
		const maxWaitTime = 300000; // 5 minutes
		const startTime = Date.now();

		while (Date.now() - startTime < maxWaitTime) {
			const description = await this.client
				.describeStream({
					StreamName: this.config.topic,
				})
				.promise();

			if (description.StreamDescription.StreamStatus === 'ACTIVE') {
				return;
			}

			await new Promise((resolve) => setTimeout(resolve, 5000));
		}

		throw new Error(
			`Kinesis stream ${this.config.topic} did not become active within timeout`
		);
	}

	/**
	 * Load a single record
	 */
	async loadRecord(record) {
		try {
			const message = await this.prepareMessage(record);

			if (this.config.delivery.batchSize > 1) {
				return await this.bufferMessage(message);
			} else {
				return await this.sendMessage(message);
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
			return { successful: 0, failed: 0, buffered: 0 };
		}

		const results = {
			successful: 0,
			failed: 0,
			buffered: 0,
		};

		// Prepare all messages
		const messages = [];
		for (const record of records) {
			try {
				const message = await this.prepareMessage(record);
				messages.push(message);
			} catch (error) {
				results.failed++;
				logger.error('Failed to prepare message:', error);

				if (!this.config.continueOnError) {
					throw error;
				}
			}
		}

		// Send messages
		if (this.config.delivery.batchSize > 1) {
			// Batch sending
			for (
				let i = 0;
				i < messages.length;
				i += this.config.delivery.batchSize
			) {
				const batch = messages.slice(i, i + this.config.delivery.batchSize);

				try {
					const batchResult = await this.sendMessageBatch(batch);
					results.successful += batchResult.successful;
					results.failed += batchResult.failed;
				} catch (error) {
					results.failed += batch.length;
					logger.error('Failed to send message batch:', error);

					if (!this.config.continueOnError) {
						throw error;
					}
				}
			}
		} else {
			// Individual sending
			for (const message of messages) {
				try {
					await this.sendMessage(message);
					results.successful++;
				} catch (error) {
					results.failed++;
					logger.error('Failed to send message:', error);

					if (!this.config.continueOnError) {
						throw error;
					}
				}
			}
		}

		return results;
	}

	/**
	 * Prepare message from record
	 */
	async prepareMessage(record) {
		const message = {
			key: this.extractMessageKey(record),
			value: this.serializeValue(record),
			partition: this.calculatePartition(record),
			timestamp: Date.now(),
			headers: this.extractHeaders(record),
		};

		return message;
	}

	/**
	 * Extract message key from record
	 */
	extractMessageKey(record) {
		if (this.config.partitioning.key) {
			const keyValue = record[this.config.partitioning.key];
			return this.serializeKey(keyValue);
		}

		return null;
	}

	/**
	 * Serialize message key
	 */
	serializeKey(key) {
		if (key === null || key === undefined) {
			return null;
		}

		switch (this.config.serialization.keySerializer) {
			case 'string':
				return String(key);
			case 'json':
				return JSON.stringify(key);
			case 'avro':
				return this.serializeAvro(key, this.config.keySchema);
			default:
				return String(key);
		}
	}

	/**
	 * Serialize message value
	 */
	serializeValue(value) {
		switch (this.config.serialization.valueSerializer) {
			case 'json':
				return JSON.stringify(value);
			case 'avro':
				return this.serializeAvro(value, this.config.valueSchema);
			case 'protobuf':
				return this.serializeProtobuf(value);
			case 'string':
				return typeof value === 'string' ? value : JSON.stringify(value);
			default:
				return JSON.stringify(value);
		}
	}

	/**
	 * Serialize Avro (placeholder - requires avro library)
	 */
	serializeAvro(data, schema) {
		// Placeholder for Avro serialization
		// const avro = require('avsc');
		// const type = avro.Type.forSchema(schema);
		// return type.toBuffer(data);
		return JSON.stringify(data);
	}

	/**
	 * Serialize Protobuf (placeholder - requires protobuf library)
	 */
	serializeProtobuf(data) {
		// Placeholder for Protobuf serialization
		return JSON.stringify(data);
	}

	/**
	 * Calculate partition for message
	 */
	calculatePartition(record) {
		switch (this.config.partitioning.strategy) {
			case 'key-based':
				if (
					this.config.partitioning.key &&
					record[this.config.partitioning.key]
				) {
					const key = String(record[this.config.partitioning.key]);
					return this.hashCode(key) % this.config.partitioning.partitions;
				}
				return Math.floor(Math.random() * this.config.partitioning.partitions);

			case 'random':
				return Math.floor(Math.random() * this.config.partitioning.partitions);

			case 'round-robin':
				this.roundRobinCounter = (this.roundRobinCounter || 0) + 1;
				return this.roundRobinCounter % this.config.partitioning.partitions;

			default:
				return 0;
		}
	}

	/**
	 * Hash code function
	 */
	hashCode(str) {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash);
	}

	/**
	 * Extract headers from record
	 */
	extractHeaders(record) {
		const headers = {};

		// Add standard headers
		headers['content-type'] = this.config.serialization.valueSerializer;
		headers['timestamp'] = Date.now().toString();
		headers['loader-id'] = this.config.loaderId || 'etl-stream-loader';

		// Add custom headers if configured
		if (this.config.customHeaders) {
			for (const [headerName, fieldName] of Object.entries(
				this.config.customHeaders
			)) {
				if (record[fieldName] !== undefined) {
					headers[headerName] = String(record[fieldName]);
				}
			}
		}

		return headers;
	}

	/**
	 * Buffer message for batch sending
	 */
	async bufferMessage(message) {
		this.messageBuffer.push(message);

		if (this.messageBuffer.length >= this.config.delivery.batchSize) {
			await this.flushBuffer();
		}

		return { buffered: true };
	}

	/**
	 * Send single message
	 */
	async sendMessage(message) {
		switch (this.config.streamType) {
			case 'kafka':
				return await this.sendKafkaMessage(message);
			case 'redis':
				return await this.sendRedisMessage(message);
			case 'rabbitmq':
				return await this.sendRabbitMQMessage(message);
			case 'kinesis':
				return await this.sendKinesisMessage(message);
			default:
				throw new Error(`Unsupported stream type: ${this.config.streamType}`);
		}
	}

	/**
	 * Send message batch
	 */
	async sendMessageBatch(messages) {
		switch (this.config.streamType) {
			case 'kafka':
				return await this.sendKafkaMessageBatch(messages);
			case 'redis':
				return await this.sendRedisMessageBatch(messages);
			case 'rabbitmq':
				return await this.sendRabbitMQMessageBatch(messages);
			case 'kinesis':
				return await this.sendKinesisMessageBatch(messages);
			default:
				throw new Error(
					`Batch sending not supported for ${this.config.streamType}`
				);
		}
	}

	/**
	 * Send Kafka message
	 */
	async sendKafkaMessage(message) {
		const kafkaMessage = {
			topic: this.config.topic,
			partition: message.partition,
			key: message.key,
			value: message.value,
			timestamp: message.timestamp,
			headers: message.headers,
		};

		await this.producer.send({
			topic: this.config.topic,
			messages: [kafkaMessage],
		});

		return { sent: true };
	}

	/**
	 * Send Kafka message batch
	 */
	async sendKafkaMessageBatch(messages) {
		const kafkaMessages = messages.map((message) => ({
			partition: message.partition,
			key: message.key,
			value: message.value,
			timestamp: message.timestamp,
			headers: message.headers,
		}));

		await this.producer.send({
			topic: this.config.topic,
			messages: kafkaMessages,
		});

		return { successful: messages.length, failed: 0 };
	}

	/**
	 * Send Redis message
	 */
	async sendRedisMessage(message) {
		const streamKey = this.config.topic;
		const fields = {
			data: message.value,
			key: message.key || '',
			timestamp: message.timestamp,
			...message.headers,
		};

		await this.client.xadd(streamKey, '*', ...Object.entries(fields).flat());
		return { sent: true };
	}

	/**
	 * Send Redis message batch
	 */
	async sendRedisMessageBatch(messages) {
		const pipeline = this.client.pipeline();

		for (const message of messages) {
			const streamKey = this.config.topic;
			const fields = {
				data: message.value,
				key: message.key || '',
				timestamp: message.timestamp,
				...message.headers,
			};

			pipeline.xadd(streamKey, '*', ...Object.entries(fields).flat());
		}

		await pipeline.exec();
		return { successful: messages.length, failed: 0 };
	}

	/**
	 * Send RabbitMQ message
	 */
	async sendRabbitMQMessage(message) {
		const options = {
			persistent: true,
			timestamp: message.timestamp,
			headers: message.headers,
		};

		if (message.key) {
			options.messageId = message.key;
		}

		await this.channel.sendToQueue(
			this.config.topic,
			Buffer.from(message.value),
			options
		);

		return { sent: true };
	}

	/**
	 * Send RabbitMQ message batch
	 */
	async sendRabbitMQMessageBatch(messages) {
		let successful = 0;
		let failed = 0;

		for (const message of messages) {
			try {
				await this.sendRabbitMQMessage(message);
				successful++;
			} catch (error) {
				failed++;
				logger.error('Failed to send RabbitMQ message:', error);
			}
		}

		return { successful, failed };
	}

	/**
	 * Send Kinesis message
	 */
	async sendKinesisMessage(message) {
		const params = {
			StreamName: this.config.topic,
			Data: message.value,
			PartitionKey: message.key || String(message.partition),
		};

		await this.client.putRecord(params).promise();
		return { sent: true };
	}

	/**
	 * Send Kinesis message batch
	 */
	async sendKinesisMessageBatch(messages) {
		const records = messages.map((message) => ({
			Data: message.value,
			PartitionKey: message.key || String(message.partition),
		}));

		const params = {
			StreamName: this.config.topic,
			Records: records,
		};

		const result = await this.client.putRecords(params).promise();

		return {
			successful: records.length - result.FailedRecordCount,
			failed: result.FailedRecordCount,
		};
	}

	/**
	 * Flush message buffer
	 */
	async flushBuffer() {
		if (this.messageBuffer.length === 0) {
			return;
		}

		const messages = [...this.messageBuffer];
		this.messageBuffer = [];

		try {
			await this.sendMessageBatch(messages);
			logger.debug(`Flushed ${messages.length} messages`);
		} catch (error) {
			logger.error('Failed to flush message buffer:', error);

			// Re-add messages to buffer if configured
			if (this.config.retryFailedFlush) {
				this.messageBuffer.unshift(...messages);
			}

			throw error;
		}
	}

	/**
	 * Start background flush
	 */
	startBackgroundFlush() {
		this.flushInterval = setInterval(async () => {
			try {
				await this.flushBuffer();
			} catch (error) {
				logger.error('Background flush failed:', error);
			}
		}, this.config.delivery.lingerMs);
	}

	/**
	 * Stop background flush
	 */
	stopBackgroundFlush() {
		if (this.flushInterval) {
			clearInterval(this.flushInterval);
			this.flushInterval = null;
		}
	}

	/**
	 * Check existing records (not applicable for stream loading)
	 */
	async checkExistingRecords(records) {
		return [];
	}

	/**
	 * Create index (not applicable for stream loading)
	 */
	async createIndex(indexConfig) {
		// No-op for stream loading
	}

	/**
	 * Perform archival (not applicable for stream loading)
	 */
	async performArchival(cutoffDate) {
		return 0;
	}

	/**
	 * Clean up resources
	 */
	async cleanupLoader() {
		// Stop background flush
		this.stopBackgroundFlush();

		// Flush any remaining messages
		if (this.messageBuffer.length > 0) {
			try {
				await this.flushBuffer();
				logger.info(`Flushed remaining ${this.messageBuffer.length} messages`);
			} catch (error) {
				logger.error('Failed to flush remaining messages:', error);
			}
		}

		// Close connections
		try {
			switch (this.config.streamType) {
				case 'kafka':
					if (this.producer) {
						await this.producer.disconnect();
					}
					break;

				case 'redis':
					if (this.client) {
						this.client.disconnect();
					}
					break;

				case 'rabbitmq':
					if (this.channel) {
						await this.channel.close();
					}
					if (this.client) {
						await this.client.close();
					}
					break;

				case 'kinesis':
					// AWS SDK doesn't require explicit cleanup
					break;
			}

			this.isConnected = false;
			logger.info(`${this.config.streamType} stream loader cleanup completed`);
		} catch (error) {
			logger.error(`Error during ${this.config.streamType} cleanup:`, error);
		}
	}
}

module.exports = StreamLoader;
