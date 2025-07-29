/**
 * APIExtractor - Production-grade API data extraction with comprehensive features
 */

const axios = require('axios');
const EventEmitter = require('events');
const logger = require('../../utils/logger');

class APIExtractor extends EventEmitter {
	constructor(config = {}) {
		super();

		this.config = {
			// API Configuration
			apiConfig: {
				baseURL: config.apiConfig?.baseURL || '',
				timeout: config.apiConfig?.timeout || 30000,
				retries: config.apiConfig?.retries || 3,
				retryDelay: config.apiConfig?.retryDelay || 1000,
				...config.apiConfig,
			},

			// Authentication
			auth: {
				type: 'none', // bearer, oauth2, api_key, none
				token: null,
				apiKey: null,
				...config.auth,
			},

			// Pagination settings
			pagination: {
				type: 'offset', // offset, cursor, page
				pageSize: 100,
				offsetParam: 'offset',
				limitParam: 'limit',
				pageParam: 'page',
				cursorParam: 'cursor',
				...config.pagination,
			},

			// Rate limiting
			rateLimit: {
				requestsPerSecond: 10,
				requestsPerMinute: 600,
				...config.rateLimit,
			},

			// Caching
			cache: {
				enabled: false,
				ttl: 300000, // 5 minutes
				...config.cache,
			},

			// Validation
			validation: {
				enabled: false,
				schema: null,
				...config.validation,
			},

			// Request/Response transformation
			transform: {
				request: config.transform?.request || null,
				response: config.transform?.response || null,
			},

			// Batch processing
			batch: {
				enabled: false,
				size: 10,
				concurrency: 5,
				...config.batch,
			},
		};

		this.httpClient = null;
		this.cache = new Map();
		this.requestQueue = [];
		this.isProcessingQueue = false;
		this.rateLimiter = {
			requests: [],
			lastMinuteRequests: [],
		};

		// OAuth2 specific
		this.oauthToken = null;
		this.oauthExpiry = null;

		this.initialized = false;
	}

	/**
	 * Initialize the extractor
	 */
	async initialize() {
		if (this.initialized) return;

		// Create HTTP client
		this.httpClient = axios.create({
			baseURL: this.config.apiConfig.baseURL,
			timeout: this.config.apiConfig.timeout,
			headers: {
				'User-Agent': 'StarkPulse-ETL/1.0',
				Accept: 'application/json',
			},
		});

		// Setup authentication
		await this.setupAuthentication();

		// Setup interceptors
		this.setupInterceptors();

		this.initialized = true;
		logger.info('APIExtractor initialized successfully');
	}

	/**
	 * Setup authentication
	 */
	async setupAuthentication() {
		const { auth } = this.config;

		switch (auth.type) {
			case 'bearer':
				if (auth.token) {
					this.httpClient.defaults.headers.common[
						'Authorization'
					] = `Bearer ${auth.token}`;
				}
				break;

			case 'api_key':
				if (auth.apiKey) {
					if (auth.location === 'header') {
						this.httpClient.defaults.headers.common[
							auth.headerName || 'X-API-Key'
						] = auth.apiKey;
					}
				}
				break;

			case 'oauth2':
				await this.refreshOAuthToken();
				break;
		}
	}

	/**
	 * Setup request/response interceptors
	 */
	setupInterceptors() {
		// Request interceptor
		this.httpClient.interceptors.request.use(
			async (config) => {
				// Rate limiting
				await this.checkRateLimit();

				// Request transformation
				if (this.config.transform.request) {
					config = await this.config.transform.request(config);
				}

				return config;
			},
			(error) => Promise.reject(error)
		);

		// Response interceptor
		this.httpClient.interceptors.response.use(
			async (response) => {
				// Response transformation
				if (this.config.transform.response) {
					response = await this.config.transform.response(response);
				}

				return response;
			},
			async (error) => {
				// Handle rate limiting
				if (error.response?.status === 429) {
					const retryAfter = error.response.headers['retry-after'] || 60;
					await new Promise((resolve) =>
						setTimeout(resolve, retryAfter * 1000)
					);
					return this.httpClient.request(error.config);
				}

				return Promise.reject(error);
			}
		);
	}

	/**
	 * Check rate limiting
	 */
	async checkRateLimit() {
		const now = Date.now();
		const oneSecondAgo = now - 1000;
		const oneMinuteAgo = now - 60000;

		// Clean old requests
		this.rateLimiter.requests = this.rateLimiter.requests.filter(
			(time) => time > oneSecondAgo
		);
		this.rateLimiter.lastMinuteRequests =
			this.rateLimiter.lastMinuteRequests.filter((time) => time > oneMinuteAgo);

		// Check per-second limit
		if (
			this.rateLimiter.requests.length >=
			this.config.rateLimit.requestsPerSecond
		) {
			const waitTime = 1000 - (now - this.rateLimiter.requests[0]);
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}

		// Check per-minute limit
		if (
			this.rateLimiter.lastMinuteRequests.length >=
			this.config.rateLimit.requestsPerMinute
		) {
			const waitTime = 60000 - (now - this.rateLimiter.lastMinuteRequests[0]);
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}

		// Record request
		this.rateLimiter.requests.push(now);
		this.rateLimiter.lastMinuteRequests.push(now);
	}

	/**
	 * Refresh OAuth2 token
	 */
	async refreshOAuthToken() {
		const { auth } = this.config;

		if (!auth.tokenUrl || !auth.clientId || !auth.clientSecret) {
			throw new Error('OAuth2 configuration incomplete');
		}

		// Check if token is still valid
		if (this.oauthToken && this.oauthExpiry && Date.now() < this.oauthExpiry) {
			return;
		}

		try {
			const response = await axios.post(
				auth.tokenUrl,
				{
					grant_type: 'client_credentials',
					client_id: auth.clientId,
					client_secret: auth.clientSecret,
					scope: auth.scope || '',
				},
				{
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
				}
			);

			this.oauthToken = response.data.access_token;
			this.oauthExpiry = Date.now() + response.data.expires_in * 1000;

			this.httpClient.defaults.headers.common[
				'Authorization'
			] = `Bearer ${this.oauthToken}`;

			logger.info('OAuth2 token refreshed successfully');
		} catch (error) {
			logger.error('Failed to refresh OAuth2 token:', error);
			throw error;
		}
	}

	/**
	 * Extract data from API endpoint
	 */
	async extract(config = {}) {
		if (!this.initialized) {
			await this.initialize();
		}

		const extractConfig = {
			endpoint: config.endpoint || '/',
			method: config.method || 'GET',
			params: config.params || {},
			data: config.data || null,
			headers: config.headers || {},
			...config,
		};

		try {
			let allData = [];
			let hasMore = true;
			let pageInfo = { offset: 0, page: 1, cursor: null };

			while (hasMore) {
				const requestConfig = {
					url: extractConfig.endpoint,
					method: extractConfig.method,
					params: { ...extractConfig.params },
					data: extractConfig.data,
					headers: extractConfig.headers,
				};

				// Add pagination parameters
				this.addPaginationParams(requestConfig, pageInfo);

				// Check cache first
				const cacheKey = this.getCacheKey(requestConfig);
				if (this.config.cache.enabled && this.cache.has(cacheKey)) {
					const cached = this.cache.get(cacheKey);
					if (Date.now() - cached.timestamp < this.config.cache.ttl) {
						return cached.data;
					}
				}

				const response = await this.makeRequest(requestConfig);
				const responseData = response.data;

				// Validate response
				if (this.config.validation.enabled) {
					this.validateResponse(responseData);
				}

				// Extract data from response
				const extractedData = this.extractDataFromResponse(responseData);
				allData = allData.concat(extractedData);

				// Update pagination info
				const paginationInfo = this.extractPaginationInfo(
					responseData,
					pageInfo
				);
				hasMore = paginationInfo.hasMore;
				pageInfo = paginationInfo.nextPage;

				// Cache successful response
				if (this.config.cache.enabled) {
					this.cache.set(cacheKey, {
						data:
							allData.length === extractedData.length ? allData : extractedData,
						timestamp: Date.now(),
					});
				}

				this.emit('data_extracted', {
					page: pageInfo.page - 1,
					records: extractedData.length,
					total: allData.length,
				});
			}

			logger.info(`APIExtractor extracted ${allData.length} records`);
			return allData;
		} catch (error) {
			logger.error('APIExtractor extraction failed:', error);
			throw error;
		}
	}

	/**
	 * Make HTTP request with retry logic
	 */
	async makeRequest(config, retryCount = 0) {
		try {
			const response = await this.httpClient.request(config);
			return response;
		} catch (error) {
			if (
				retryCount < this.config.apiConfig.retries &&
				this.shouldRetry(error)
			) {
				logger.warn(
					`Request failed, retrying (${retryCount + 1}/${
						this.config.apiConfig.retries
					}):`,
					error.message
				);
				await new Promise((resolve) =>
					setTimeout(
						resolve,
						this.config.apiConfig.retryDelay * Math.pow(2, retryCount)
					)
				);
				return this.makeRequest(config, retryCount + 1);
			}
			throw error;
		}
	}

	/**
	 * Check if request should be retried
	 */
	shouldRetry(error) {
		if (!error.response) return true; // Network errors

		const retryStatuses = [408, 429, 500, 502, 503, 504];
		return retryStatuses.includes(error.response.status);
	}

	/**
	 * Add pagination parameters to request
	 */
	addPaginationParams(requestConfig, pageInfo) {
		const { pagination } = this.config;

		switch (pagination.type) {
			case 'offset':
				requestConfig.params[pagination.offsetParam] = pageInfo.offset;
				requestConfig.params[pagination.limitParam] = pagination.pageSize;
				break;

			case 'page':
				requestConfig.params[pagination.pageParam] = pageInfo.page;
				requestConfig.params[pagination.limitParam] = pagination.pageSize;
				break;

			case 'cursor':
				if (pageInfo.cursor) {
					requestConfig.params[pagination.cursorParam] = pageInfo.cursor;
				}
				requestConfig.params[pagination.limitParam] = pagination.pageSize;
				break;
		}
	}

	/**
	 * Extract data from API response
	 */
	extractDataFromResponse(response) {
		// Handle different response structures
		if (Array.isArray(response)) {
			return response;
		}

		if (response.data && Array.isArray(response.data)) {
			return response.data;
		}

		if (response.items && Array.isArray(response.items)) {
			return response.items;
		}

		if (response.results && Array.isArray(response.results)) {
			return response.results;
		}

		// If single object, wrap in array
		return [response];
	}

	/**
	 * Extract pagination information from response
	 */
	extractPaginationInfo(response, currentPageInfo) {
		const { pagination } = this.config;

		let hasMore = false;
		let nextPage = { ...currentPageInfo };

		switch (pagination.type) {
			case 'offset':
				const totalCount =
					response.total || response.totalCount || response.count;
				if (totalCount) {
					hasMore = currentPageInfo.offset + pagination.pageSize < totalCount;
					nextPage.offset += pagination.pageSize;
				} else {
					// Check if we got a full page
					const dataArray = this.extractDataFromResponse(response);
					hasMore = dataArray.length === pagination.pageSize;
					nextPage.offset += pagination.pageSize;
				}
				break;

			case 'page':
				const totalPages = response.totalPages || response.pageCount;
				if (totalPages) {
					hasMore = currentPageInfo.page < totalPages;
				} else {
					const dataArray = this.extractDataFromResponse(response);
					hasMore = dataArray.length === pagination.pageSize;
				}
				nextPage.page += 1;
				break;

			case 'cursor':
				hasMore = !!response.nextCursor || !!response.next_cursor;
				nextPage.cursor = response.nextCursor || response.next_cursor;
				break;
		}

		return { hasMore, nextPage };
	}

	/**
	 * Validate response data
	 */
	validateResponse(data) {
		if (!this.config.validation.schema) return;

		// Simple schema validation (could be extended with ajv or joi)
		const schema = this.config.validation.schema;

		if (schema.required && Array.isArray(schema.required)) {
			schema.required.forEach((field) => {
				if (!(field in data)) {
					throw new Error(`Required field '${field}' missing from response`);
				}
			});
		}

		if (schema.type && typeof data !== schema.type) {
			throw new Error(
				`Expected response type '${schema.type}', got '${typeof data}'`
			);
		}
	}

	/**
	 * Generate cache key for request
	 */
	getCacheKey(requestConfig) {
		return JSON.stringify({
			url: requestConfig.url,
			method: requestConfig.method,
			params: requestConfig.params,
			data: requestConfig.data,
		});
	}

	/**
	 * Process multiple endpoints in batches
	 */
	async extractBatch(endpoints) {
		if (!this.config.batch.enabled) {
			// Process sequentially
			const results = [];
			for (const endpoint of endpoints) {
				try {
					const data = await this.extract(endpoint);
					results.push({ endpoint, data, success: true });
				} catch (error) {
					results.push({ endpoint, error, success: false });
				}
			}
			return results;
		}

		// Process in batches with concurrency
		const results = [];
		const { size, concurrency } = this.config.batch;

		for (let i = 0; i < endpoints.length; i += size) {
			const batch = endpoints.slice(i, i + size);
			const batchPromises = batch.map(async (endpoint) => {
				try {
					const data = await this.extract(endpoint);
					return { endpoint, data, success: true };
				} catch (error) {
					return { endpoint, error, success: false };
				}
			});

			// Limit concurrency
			const batchResults = [];
			for (let j = 0; j < batchPromises.length; j += concurrency) {
				const concurrentBatch = batchPromises.slice(j, j + concurrency);
				const concurrentResults = await Promise.all(concurrentBatch);
				batchResults.push(...concurrentResults);
			}

			results.push(...batchResults);
		}

		return results;
	}

	/**
	 * Cleanup resources
	 */
	async cleanup() {
		if (this.httpClient) {
			// Cancel any pending requests
			delete this.httpClient;
		}

		// Clear cache
		this.cache.clear();

		// Reset state
		this.initialized = false;
		this.oauthToken = null;
		this.oauthExpiry = null;

		logger.info('APIExtractor cleanup completed');
	}
}

module.exports = { APIExtractor };
