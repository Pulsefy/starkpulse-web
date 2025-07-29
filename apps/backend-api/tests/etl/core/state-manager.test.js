/**
 * Unit tests for StateManager
 */

const StateManager = require('../../../src/etl/core/state-manager');
const fs = require('fs').promises;
const path = require('path');
const mockFs = require('mock-fs');

// Mock dependencies
jest.mock('../../../src/utils/logger', () => ({
	info: jest.fn(),
	error: jest.fn(),
	warn: jest.fn(),
	debug: jest.fn(),
}));

// Mock Redis client
const mockRedisClient = {
	set: jest.fn(),
	get: jest.fn(),
	del: jest.fn(),
	hset: jest.fn(),
	hget: jest.fn(),
	hdel: jest.fn(),
	keys: jest.fn(),
	exists: jest.fn(),
	expire: jest.fn(),
	quit: jest.fn(),
};

// Mock MongoDB client
const mockMongoCollection = {
	insertOne: jest.fn(),
	findOne: jest.fn(),
	updateOne: jest.fn(),
	deleteOne: jest.fn(),
	find: jest.fn(() => ({
		toArray: jest.fn(),
	})),
	deleteMany: jest.fn(),
};

const mockMongoClient = {
	collection: jest.fn(() => mockMongoCollection),
};

// Make MongoDB mocks globally available
global.mockMongoCollection = mockMongoCollection;

describe('StateManager', () => {
	let stateManager;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterEach(() => {
		mockFs.restore();
	});

	describe('Filesystem Storage', () => {
		beforeEach(() => {
			stateManager = new StateManager({
				storage: 'filesystem',
				filesystem: {
					basePath: '/tmp/etl-state',
					inMemory: true, // Use in-memory filesystem for testing
				},
			});
		});

		test('should save state to filesystem', async () => {
			const state = {
				pipelineId: 'test-pipeline',
				status: 'running',
				lastProcessedId: 12345,
				timestamp: new Date(),
			};

			await stateManager.saveState('test-pipeline', state);

			// Load the state back to verify it was saved correctly
			const savedState = await stateManager.loadState('test-pipeline');

			expect(savedState.pipelineId).toBe('test-pipeline');
			expect(savedState.status).toBe('running');
			expect(savedState.lastProcessedId).toBe(12345);
		});

		test('should load state from filesystem', async () => {
			const state = {
				pipelineId: 'test-pipeline',
				status: 'completed',
				lastProcessedId: 67890,
			};

			// Save state first
			await stateManager.saveState('test-pipeline', state);

			// Load state back
			const loadedState = await stateManager.loadState('test-pipeline');

			expect(loadedState.pipelineId).toBe('test-pipeline');
			expect(loadedState.status).toBe('completed');
			expect(loadedState.lastProcessedId).toBe(67890);
		});

		test('should return empty object when state file does not exist', async () => {
			const loadedState = await stateManager.loadState('nonexistent-pipeline');
			expect(loadedState).toEqual({});
		});

		test('should clear state from filesystem', async () => {
			const state = {
				pipelineId: 'test-pipeline',
				status: 'running',
			};

			// Save state first
			await stateManager.saveState('test-pipeline', state);

			// Verify it exists
			let loadedState = await stateManager.loadState('test-pipeline');
			expect(loadedState).not.toEqual({});

			// Clear the state
			await stateManager.clearState('test-pipeline');

			// Verify it's gone (should return empty object)
			loadedState = await stateManager.loadState('test-pipeline');
			expect(loadedState).toEqual({});
		});

		test('should create checkpoint', async () => {
			const checkpointData = {
				recordsProcessed: 1000,
				lastRecordId: 'abc123',
				timestamp: new Date(),
			};

			const checkpointId = await stateManager.createCheckpoint(
				'test-pipeline',
				checkpointData
			);

			expect(checkpointId).toBeDefined();

			// Verify checkpoint file was created
			const files = await stateManager.listFilesystemFiles();
			const checkpointFiles = files.filter((f) =>
				f.startsWith('test-pipeline_checkpoint_')
			);
			expect(checkpointFiles).toHaveLength(1);
		});

		test('should load from checkpoint', async () => {
			const checkpointData = {
				recordsProcessed: 1000,
				lastRecordId: 'abc123',
			};

			// Create a checkpoint first
			const checkpointId = await stateManager.createCheckpoint(
				'test-pipeline',
				checkpointData
			);

			// Load from checkpoint
			const loadedData = await stateManager.loadFromCheckpoint(
				'test-pipeline',
				checkpointId
			);

			expect(loadedData.recordsProcessed).toBe(1000);
			expect(loadedData.lastRecordId).toBe('abc123');
		});
	});

	describe('Redis Storage', () => {
		beforeEach(() => {
			stateManager = new StateManager({
				storage: 'redis',
				redis: {
					client: mockRedisClient,
				},
			});
		});

		test('should save state to Redis', async () => {
			mockRedisClient.set.mockResolvedValue('OK');

			const state = {
				pipelineId: 'test-pipeline',
				status: 'running',
				lastProcessedId: 12345,
			};

			await stateManager.saveState('test-pipeline', state);

			expect(mockRedisClient.set).toHaveBeenCalledWith(
				'etl:state:test-pipeline',
				JSON.stringify(state),
				'EX',
				expect.any(Number)
			);
		});

		test('should load state from Redis', async () => {
			const state = {
				pipelineId: 'test-pipeline',
				status: 'completed',
			};

			mockRedisClient.get.mockResolvedValue(JSON.stringify(state));

			const loadedState = await stateManager.loadState('test-pipeline');

			expect(mockRedisClient.get).toHaveBeenCalledWith(
				'etl:state:test-pipeline'
			);
			expect(loadedState.pipelineId).toBe('test-pipeline');
			expect(loadedState.status).toBe('completed');
		});

		test('should return empty object when Redis key does not exist', async () => {
			mockRedisClient.get.mockResolvedValue(null);

			const loadedState = await stateManager.loadState('nonexistent-pipeline');

			expect(loadedState).toEqual({});
		});

		test('should clear state from Redis', async () => {
			mockRedisClient.del.mockResolvedValue(1);

			await stateManager.clearState('test-pipeline');

			expect(mockRedisClient.del).toHaveBeenCalledWith(
				'etl:state:test-pipeline'
			);
		});

		test('should create checkpoint in Redis', async () => {
			mockRedisClient.hset.mockResolvedValue(1);

			const checkpointData = {
				recordsProcessed: 1000,
				lastRecordId: 'abc123',
			};

			const checkpointId = await stateManager.createCheckpoint(
				'test-pipeline',
				checkpointData
			);

			expect(mockRedisClient.hset).toHaveBeenCalledWith(
				'etl:checkpoints:test-pipeline',
				checkpointId,
				JSON.stringify(checkpointData)
			);
			expect(checkpointId).toBeDefined();
		});

		test('should load from checkpoint in Redis', async () => {
			const checkpointData = {
				recordsProcessed: 1000,
				lastRecordId: 'abc123',
			};

			mockRedisClient.hget.mockResolvedValue(JSON.stringify(checkpointData));

			const loadedData = await stateManager.loadFromCheckpoint(
				'test-pipeline',
				'checkpoint-123'
			);

			expect(mockRedisClient.hget).toHaveBeenCalledWith(
				'etl:checkpoints:test-pipeline',
				'checkpoint-123'
			);
			expect(loadedData.recordsProcessed).toBe(1000);
			expect(loadedData.lastRecordId).toBe('abc123');
		});
	});

	describe('MongoDB Storage', () => {
		beforeEach(() => {
			stateManager = new StateManager({
				storage: 'mongodb',
				mongodb: {
					client: mockMongoClient,
				},
			});
		});

		test('should save state to MongoDB', async () => {
			mockMongoCollection.updateOne.mockResolvedValue({ upsertedCount: 1 });

			const state = {
				pipelineId: 'test-pipeline',
				status: 'running',
				lastProcessedId: 12345,
			};

			await stateManager.saveState('test-pipeline', state);

			expect(mockMongoCollection.updateOne).toHaveBeenCalledWith(
				{ pipelineId: 'test-pipeline' },
				{ $set: { ...state, updatedAt: expect.any(Date) } },
				{ upsert: true }
			);
		});

		test('should load state from MongoDB', async () => {
			const state = {
				pipelineId: 'test-pipeline',
				status: 'completed',
				lastProcessedId: 67890,
			};

			mockMongoCollection.findOne.mockResolvedValue(state);

			const loadedState = await stateManager.loadState('test-pipeline');

			expect(mockMongoCollection.findOne).toHaveBeenCalledWith({
				pipelineId: 'test-pipeline',
			});
			expect(loadedState.pipelineId).toBe('test-pipeline');
			expect(loadedState.status).toBe('completed');
		});

		test('should return empty object when MongoDB document does not exist', async () => {
			mockMongoCollection.findOne.mockResolvedValue(null);

			const loadedState = await stateManager.loadState('nonexistent-pipeline');

			expect(loadedState).toEqual({});
		});

		test('should clear state from MongoDB', async () => {
			mockMongoCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

			await stateManager.clearState('test-pipeline');

			expect(mockMongoCollection.deleteOne).toHaveBeenCalledWith({
				pipelineId: 'test-pipeline',
			});
		});

		test('should create checkpoint in MongoDB', async () => {
			mockMongoCollection.insertOne.mockResolvedValue({
				insertedId: 'checkpoint-id',
			});

			const checkpointData = {
				recordsProcessed: 1000,
				lastRecordId: 'abc123',
			};

			const checkpointId = await stateManager.createCheckpoint(
				'test-pipeline',
				checkpointData
			);

			expect(mockMongoCollection.insertOne).toHaveBeenCalledWith({
				pipelineId: 'test-pipeline',
				checkpointId: expect.any(String),
				data: checkpointData,
				createdAt: expect.any(Date),
			});
			expect(checkpointId).toBeDefined();
		});

		test('should load from checkpoint in MongoDB', async () => {
			const checkpointDoc = {
				pipelineId: 'test-pipeline',
				checkpointId: 'checkpoint-123',
				data: {
					recordsProcessed: 1000,
					lastRecordId: 'abc123',
				},
			};

			mockMongoCollection.findOne.mockResolvedValue(checkpointDoc);

			const loadedData = await stateManager.loadFromCheckpoint(
				'test-pipeline',
				'checkpoint-123'
			);

			expect(mockMongoCollection.findOne).toHaveBeenCalledWith({
				pipelineId: 'test-pipeline',
				checkpointId: 'checkpoint-123',
			});
			expect(loadedData.recordsProcessed).toBe(1000);
			expect(loadedData.lastRecordId).toBe('abc123');
		});
	});

	describe('State History', () => {
		beforeEach(() => {
			stateManager = new StateManager({
				storage: 'filesystem',
				filesystem: { basePath: '/tmp/etl-state' },
				history: { enabled: true, maxEntries: 10 },
			});
		});

		test('should maintain state history', async () => {
			mockFs({
				'/tmp/etl-state': {},
			});

			const state1 = { pipelineId: 'test-pipeline', status: 'running' };
			const state2 = { pipelineId: 'test-pipeline', status: 'completed' };

			await stateManager.saveState('test-pipeline', state1);
			await stateManager.saveState('test-pipeline', state2);

			const history = await stateManager.getStateHistory('test-pipeline');

			expect(history).toHaveLength(2);
			expect(history[0].status).toBe('running');
			expect(history[1].status).toBe('completed');
		});

		test('should limit state history size', async () => {
			const limitedStateManager = new StateManager({
				storage: 'filesystem',
				filesystem: { basePath: '/tmp/etl-state' },
				history: { enabled: true, maxEntries: 2 },
			});

			mockFs({
				'/tmp/etl-state': {},
			});

			for (let i = 1; i <= 5; i++) {
				await limitedStateManager.saveState('test-pipeline', {
					pipelineId: 'test-pipeline',
					iteration: i,
				});
			}

			const history = await limitedStateManager.getStateHistory(
				'test-pipeline'
			);

			expect(history).toHaveLength(2);
			expect(history[0].iteration).toBe(4);
			expect(history[1].iteration).toBe(5);
		});
	});

	describe('Cleanup Tasks', () => {
		beforeEach(() => {
			stateManager = new StateManager({
				storage: 'filesystem',
				filesystem: {
					basePath: '/tmp/etl-state',
					inMemory: true,
				},
				cleanup: {
					enabled: true,
					maxAge: 24 * 60 * 60 * 1000, // 24 hours
					interval: 60 * 60 * 1000, // 1 hour
				},
			});
		});

		test('should start cleanup task', () => {
			const startCleanupSpy = jest.spyOn(stateManager, 'startCleanupTask');

			stateManager.startCleanupTask();

			expect(startCleanupSpy).toHaveBeenCalled();
			expect(stateManager.cleanupInterval).toBeDefined();
		});

		test('should stop cleanup task', () => {
			stateManager.startCleanupTask();

			const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

			stateManager.stopCleanupTask();

			expect(clearIntervalSpy).toHaveBeenCalled();
			expect(stateManager.cleanupInterval).toBeNull();
		});

		test('should clean up old files', async () => {
			// Create old and recent states
			const oldState = {
				pipelineId: 'old-pipeline',
				timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
			};
			const recentState = {
				pipelineId: 'recent-pipeline',
				timestamp: new Date(),
			};

			await stateManager.saveState('old-pipeline', oldState);
			await stateManager.saveState('recent-pipeline', recentState);

			// Run cleanup for anything older than 24 hours
			await stateManager.cleanupOldStates();

			const files = await stateManager.listFilesystemFiles();
			expect(files).toContain('recent-pipeline.json');
			expect(files).not.toContain('old-pipeline.json');
		});
	});
});
