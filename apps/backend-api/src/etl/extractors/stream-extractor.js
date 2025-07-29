/**
 * Stream Extractor
 * Extracts data from real-time streams (Kafka, Redis Streams, WebSockets)
 */

const BaseExtractor = require('./base-extractor');
const EventEmitter = require('eventemitter3');
const logger = require('../../utils/logger');

class StreamExtractor extends BaseExtractor {
	constructor(config = {}) {
		super(config);
		this.config = {
			...this.config,
			streamType: config.streamType || 'kafka', // kafka, redis-stream, websocket, rabbitmq
			connectionConfig: config.connectionConfig || {},
			topic: config.topic,
			consumerGroup: config.consumerGroup,
			autoCommit: config.autoCommit !== false,
			commitInterval: config.commitInterval || 5000,
			maxWaitTime: config.maxWaitTime || 30000,
			buffer: {
				enabled: config.bufferEnabled !== false,
				maxSize: config.bufferMaxSize || 10000,
				flushInterval: config.bufferFlushInterval || 5000,
				flushOnShutdown: config.flushOnShutdown !== false,
			},
			errorHandling: {
				skipInvalidMessages: config.skipInvalidMessages !== false,
				deadLetterQueue: config.deadLetterQueue,
				maxRetries: config.maxRetries || 3,
			},
		};

		this.streamClient = null;
		this.messageBuffer = [];
		this.bufferFlushTimer = null;
		this.isConsuming = false;
		this.messageCount = 0;
		this.lastCommitTime = Date.now();
	}

	/**
	 * Initialize the stream extractor
	 */
	async initializeExtractor() {
		await this.setupStreamClient();
		await this.setupBuffer();
		logger.info(`Stream extractor initialized for ${this.config.streamType}`);
	}

	/**
	 * Setup stream client based on type
	 */
	async setupStreamClient() {
		switch (this.config.streamType) {
			case 'kafka':
				await this.setupKafkaClient();
				break;
			case 'redis-stream':
				await this.setupRedisStreamClient();
				break;
			case 'websocket':
				await this.setupWebSocketClient();
				break;
			case 'rabbitmq':
				await this.setupRabbitMQClient();
				break;
			default:
				throw new Error(`Unsupported stream type: ${this.config.streamType}`);
		}
	}

	/**
	 * Setup Kafka client
	 */
	async setupKafkaClient() {
		const { Kafka } = require('kafkajs');

		const kafka = new Kafka({
			clientId: this.config.connectionConfig.clientId || 'starkpulse-etl',
			brokers: this.config.connectionConfig.brokers || ['localhost:9092'],
			ssl: this.config.connectionConfig.ssl,
			sasl: this.config.connectionConfig.sasl,
		});

		this.streamClient = kafka.consumer({
			groupId: this.config.consumerGroup,
			sessionTimeout: 30000,
			rebalanceTimeout: 60000,
			heartbeatInterval: 3000,
			maxWaitTimeInMs: this.config.maxWaitTime,
			allowAutoTopicCreation: false,
		});

		// Setup error handling
		this.setupKafkaErrorHandling();

		// Connect and subscribe
		await this.streamClient.connect();
		await this.streamClient.subscribe({
			topic: this.config.topic,
			fromBeginning: this.config.connectionConfig.fromBeginning || false,
		});

		logger.info(`Connected to Kafka topic: ${this.config.topic}`);
	}

	/**
	 * Setup Kafka error handling
	 */
	setupKafkaErrorHandling() {
		this.streamClient.on('consumer.crash', (error) => {
			logger.error('Kafka consumer crashed:', error);
			this.emit('error', error);
		});

		this.streamClient.on('consumer.disconnect', () => {
			logger.warn('Kafka consumer disconnected');
			this.emit('disconnect');
		});

		this.streamClient.on('consumer.stop', () => {
			logger.info('Kafka consumer stopped');
			this.emit('stop');
		});
	}

	/**
	 * Setup Redis Stream client
	 */
	async setupRedisStreamClient() {
		const Redis = require('ioredis');

		this.streamClient = new Redis(this.config.connectionConfig);

		// Test connection
		await this.streamClient.ping();
		logger.info(`Connected to Redis stream: ${this.config.topic}`);
	}

	/**
	 * Setup WebSocket client
	 */
	async setupWebSocketClient() {
		const WebSocket = require('ws');

		return new Promise((resolve, reject) => {
			this.streamClient = new WebSocket(this.config.connectionConfig.url, {
				headers: this.config.connectionConfig.headers,
				protocols: this.config.connectionConfig.protocols,
			});

			this.streamClient.on('open', () => {
				logger.info(
					`Connected to WebSocket: ${this.config.connectionConfig.url}`
				);

				// Send subscription message if provided
				if (this.config.connectionConfig.subscribeMessage) {
					this.streamClient.send(
						JSON.stringify(this.config.connectionConfig.subscribeMessage)
					);
				}

				resolve();
			});

			this.streamClient.on('error', (error) => {
				logger.error('WebSocket error:', error);
				reject(error);
			});

			this.streamClient.on('close', () => {
				logger.info('WebSocket connection closed');
				this.emit('disconnect');
			});
		});
	}

	/**
	 * Setup RabbitMQ client
	 */
	async setupRabbitMQClient() {
		const amqp = require('amqplib');

		const connection = await amqp.connect(this.config.connectionConfig.url);
		const channel = await connection.createChannel();

		// Assert queue exists
		await channel.assertQueue(this.config.topic, {
			durable: this.config.connectionConfig.durable || true,
		});

		this.streamClient = { connection, channel };
		logger.info(`Connected to RabbitMQ queue: ${this.config.topic}`);
	}

	/**
	 * Setup message buffer
	 */
	setupBuffer() {
		if (!this.config.buffer.enabled) return;

		// Setup buffer flush timer
		this.bufferFlushTimer = setInterval(() => {
			this.flushBuffer();
		}, this.config.buffer.flushInterval);
	}

	/**
	 * Extract data from stream (overrides base method)
	 */
	async extract() {
		try {
			this.metrics.startTime = Date.now();
			this.isConsuming = true;

			logger.info(`Starting stream consumption from ${this.config.streamType}`);

			switch (this.config.streamType) {
				case 'kafka':
					return await this.consumeKafkaStream();
				case 'redis-stream':
					return await this.consumeRedisStream();
				case 'websocket':
					return await this.consumeWebSocketStream();
				case 'rabbitmq':
					return await this.consumeRabbitMQStream();
				default:
					throw new Error(`Unsupported stream type: ${this.config.streamType}`);
			}
		} catch (error) {
			this.metrics.errors++;
			this.isConsuming = false;
			logger.error('Stream extraction failed:', error);
			throw error;
		}
	}

	/**
	 * Consume Kafka stream
	 */
	async consumeKafkaStream() {
		return new Promise((resolve, reject) => {
			const messages = [];
			let timeoutId;

			const consumeHandler = async ({ topic, partition, message }) => {
				try {
					const data = this.parseMessage(message.value);
					if (data) {
						messages.push({
							...data,
							_metadata: {
								topic,
								partition,
								offset: message.offset,
								timestamp: message.timestamp,
								key: message.key ? message.key.toString() : null,
							},
						});

						this.messageCount++;
						this.metrics.recordsProcessed++;

						// Check if we should commit
						if (this.shouldCommit()) {
							await this.commitKafkaOffset();
						}

						// Check buffer limits
						if (messages.length >= this.config.batchSize) {
							clearTimeout(timeoutId);
							this.stopKafkaConsumer();
							resolve(messages);
						}
					}
				} catch (error) {
					logger.error('Error processing Kafka message:', error);
					this.metrics.errors++;

					if (!this.config.errorHandling.skipInvalidMessages) {
						reject(error);
					}
				}
			};

			// Setup timeout
			timeoutId = setTimeout(() => {
				this.stopKafkaConsumer();
				resolve(messages);
			}, this.config.maxWaitTime);

			// Start consuming
			this.streamClient.run({ eachMessage: consumeHandler }).catch(reject);
		});
	}

	/**
	 * Consume Redis stream
	 */
	async consumeRedisStream() {
		const messages = [];
		const startTime = Date.now();
		let lastId = '0-0';

		while (
			messages.length < this.config.batchSize &&
			Date.now() - startTime < this.config.maxWaitTime
		) {
			try {
				const result = await this.streamClient.xread(
					'COUNT',
					this.config.batchSize,
					'BLOCK',
					1000,
					'STREAMS',
					this.config.topic,
					lastId
				);

				if (result && result.length > 0) {
					const [streamName, streamMessages] = result[0];

					for (const [messageId, fields] of streamMessages) {
						const data = this.parseRedisStreamMessage(fields);
						messages.push({
							...data,
							_metadata: {
								stream: streamName,
								messageId,
								timestamp: Date.now(),
							},
						});

						lastId = messageId;
						this.messageCount++;
						this.metrics.recordsProcessed++;
					}
				}
			} catch (error) {
				if (error.message.includes('BLOCK')) {
					// Timeout, continue
					continue;
				}
				throw error;
			}
		}

		return messages;
	}

	/**
	 * Consume WebSocket stream
	 */
	async consumeWebSocketStream() {
		return new Promise((resolve, reject) => {
			const messages = [];
			let timeoutId;

			const messageHandler = (data) => {
				try {
					const parsedData = this.parseMessage(data);
					if (parsedData) {
						messages.push({
							...parsedData,
							_metadata: {
								timestamp: Date.now(),
								source: 'websocket',
							},
						});

						this.messageCount++;
						this.metrics.recordsProcessed++;

						// Check batch size
						if (messages.length >= this.config.batchSize) {
							clearTimeout(timeoutId);
							this.streamClient.removeListener('message', messageHandler);
							resolve(messages);
						}
					}
				} catch (error) {
					logger.error('Error processing WebSocket message:', error);
					this.metrics.errors++;

					if (!this.config.errorHandling.skipInvalidMessages) {
						reject(error);
					}
				}
			};

			// Setup timeout
			timeoutId = setTimeout(() => {
				this.streamClient.removeListener('message', messageHandler);
				resolve(messages);
			}, this.config.maxWaitTime);

			// Start listening
			this.streamClient.on('message', messageHandler);
		});
	}

	/**
	 * Consume RabbitMQ stream
	 */
	async consumeRabbitMQStream() {
		return new Promise((resolve, reject) => {
			const messages = [];
			let messageCount = 0;

			const consumeOptions = {
				noAck: this.config.autoCommit,
			};

			this.streamClient.channel.consume(
				this.config.topic,
				(message) => {
					if (message) {
						try {
							const data = this.parseMessage(message.content);
							if (data) {
								messages.push({
									...data,
									_metadata: {
										deliveryTag: message.fields.deliveryTag,
										exchange: message.fields.exchange,
										routingKey: message.fields.routingKey,
										timestamp: Date.now(),
									},
								});

								messageCount++;
								this.metrics.recordsProcessed++;

								// Acknowledge message if not auto-ack
								if (!this.config.autoCommit) {
									this.streamClient.channel.ack(message);
								}

								// Check batch size
								if (messages.length >= this.config.batchSize) {
									resolve(messages);
								}
							}
						} catch (error) {
							logger.error('Error processing RabbitMQ message:', error);
							this.metrics.errors++;

							if (!this.config.autoCommit) {
								this.streamClient.channel.nack(
									message,
									false,
									!this.config.errorHandling.skipInvalidMessages
								);
							}

							if (!this.config.errorHandling.skipInvalidMessages) {
								reject(error);
							}
						}
					}
				},
				consumeOptions
			);

			// Setup timeout
			setTimeout(() => {
				resolve(messages);
			}, this.config.maxWaitTime);
		});
	}

	/**
	 * Parse message based on format
	 */
	parseMessage(messageData) {
		try {
			if (Buffer.isBuffer(messageData)) {
				messageData = messageData.toString();
			}

			if (typeof messageData === 'string') {
				return JSON.parse(messageData);
			}

			return messageData;
		} catch (error) {
			logger.warn('Failed to parse message:', error.message);
			return null;
		}
	}

	/**
	 * Parse Redis stream message
	 */
	parseRedisStreamMessage(fields) {
		const message = {};
		for (let i = 0; i < fields.length; i += 2) {
			const key = fields[i];
			const value = fields[i + 1];

			try {
				message[key] = JSON.parse(value);
			} catch {
				message[key] = value;
			}
		}
		return message;
	}

	/**
	 * Check if offset should be committed
	 */
	shouldCommit() {
		if (!this.config.autoCommit) return false;

		const timeSinceCommit = Date.now() - this.lastCommitTime;
		return timeSinceCommit >= this.config.commitInterval;
	}

	/**
	 * Commit Kafka offset
	 */
	async commitKafkaOffset() {
		try {
			await this.streamClient.commitOffsets();
			this.lastCommitTime = Date.now();
			logger.debug('Kafka offset committed');
		} catch (error) {
			logger.error('Failed to commit Kafka offset:', error);
		}
	}

	/**
	 * Stop Kafka consumer
	 */
	async stopKafkaConsumer() {
		if (this.streamClient && this.isConsuming) {
			try {
				await this.streamClient.stop();
				this.isConsuming = false;
			} catch (error) {
				logger.error('Error stopping Kafka consumer:', error);
			}
		}
	}

	/**
	 * Flush message buffer
	 */
	flushBuffer() {
		if (this.messageBuffer.length === 0) return;

		logger.debug(`Flushing buffer with ${this.messageBuffer.length} messages`);

		// Emit buffered data
		this.emit('data', [...this.messageBuffer]);
		this.messageBuffer.length = 0;
	}

	/**
	 * Get extraction metrics specific to streaming
	 */
	getStreamMetrics() {
		return {
			...this.getMetrics(),
			messagesConsumed: this.messageCount,
			isConsuming: this.isConsuming,
			bufferSize: this.messageBuffer.length,
			streamType: this.config.streamType,
		};
	}

	/**
	 * Clean up resources
	 */
	async cleanup() {
		await super.cleanup();

		this.isConsuming = false;

		// Clear buffer timer
		if (this.bufferFlushTimer) {
			clearInterval(this.bufferFlushTimer);
		}

		// Flush remaining buffer
		if (this.config.buffer.flushOnShutdown) {
			this.flushBuffer();
		}

		// Close stream connections
		if (this.streamClient) {
			try {
				switch (this.config.streamType) {
					case 'kafka':
						await this.streamClient.disconnect();
						break;
					case 'redis-stream':
						await this.streamClient.quit();
						break;
					case 'websocket':
						this.streamClient.close();
						break;
					case 'rabbitmq':
						await this.streamClient.channel.close();
						await this.streamClient.connection.close();
						break;
				}

				logger.info(`${this.config.streamType} stream connection closed`);
			} catch (error) {
				logger.error(
					`Error closing ${this.config.streamType} connection:`,
					error
				);
			}
		}
	}
}

module.exports = StreamExtractor;
