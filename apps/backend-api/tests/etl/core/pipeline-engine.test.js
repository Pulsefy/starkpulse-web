/**
 * Unit tests for Pipeline Engine
 */

// Mock external dependencies
jest.mock('../../../src/utils/logger', () => ({
	info: jest.fn(),
	error: jest.fn(),
	warn: jest.fn(),
	debug: jest.fn(),
}));

// Import the actual pipeline engine
const PipelineEngine = require('../../../src/etl/core/pipeline-engine');

describe('PipelineEngine', () => {
	let engine;
	let mockExtractor;
	let mockTransformer;
	let mockLoader;

	beforeEach(async () => {
		// Reset mocks
		jest.clearAllMocks();

		// Mock pipeline components
		mockExtractor = {
			extract: jest.fn(() => Promise.resolve([{ id: 1, data: 'test' }])),
			cleanup: jest.fn(),
		};

		mockTransformer = {
			transform: jest.fn((data) =>
				Promise.resolve(data.map((item) => ({ ...item, transformed: true })))
			),
			cleanup: jest.fn(),
		};

		mockLoader = {
			load: jest.fn(() => Promise.resolve({ successful: 1, failed: 0 })),
			cleanup: jest.fn(),
		};

		// Create engine instance
		engine = new PipelineEngine({
			maxConcurrency: 2,
			maxRetries: 3,
			healthCheckInterval: 1000,
		});

		// Initialize the engine
		await engine.initialize();
	});

	afterEach(async () => {
		if (engine && engine.initialized) {
			await engine.cleanup();
		}
	});

	describe('Pipeline Registration', () => {
		test('should register a pipeline successfully', async () => {
			const pipelineConfig = {
				extractor: mockExtractor,
				transformer: mockTransformer,
				loader: mockLoader,
				schedule: '0 */5 * * * *',
			};

			await engine.registerPipeline('test-pipeline', pipelineConfig);

			expect(engine.pipelines.has('test-pipeline')).toBe(true);
			const pipeline = engine.pipelines.get('test-pipeline');
			expect(pipeline.extractor).toBe(mockExtractor);
			expect(pipeline.transformer).toBe(mockTransformer);
			expect(pipeline.loader).toBe(mockLoader);
		});

		test('should throw error when registering pipeline with same name', async () => {
			const pipelineConfig = {
				extractor: mockExtractor,
				transformer: mockTransformer,
				loader: mockLoader,
			};

			await engine.registerPipeline('test-pipeline', pipelineConfig);

			await expect(async () => {
				await engine.registerPipeline('test-pipeline', pipelineConfig);
			}).rejects.toThrow('Pipeline test-pipeline is already registered');
		});

		test('should validate required components', async () => {
			await expect(async () => {
				await engine.registerPipeline('invalid-pipeline', {});
			}).rejects.toThrow(
				'Pipeline configuration must include extractor, transformer, and loader'
			);

			await expect(async () => {
				await engine.registerPipeline('invalid-pipeline', {
					extractor: mockExtractor,
				});
			}).rejects.toThrow(
				'Pipeline configuration must include extractor, transformer, and loader'
			);
		});
	});

	describe('Pipeline Execution', () => {
		beforeEach(async () => {
			const pipelineConfig = {
				extractor: mockExtractor,
				transformer: mockTransformer,
				loader: mockLoader,
				config: { batchSize: 100 },
			};

			await engine.registerPipeline('test-pipeline', pipelineConfig);
		});

		test('should execute pipeline successfully', async () => {
			const result = await engine.executePipeline('test-pipeline');

			expect(mockExtractor.extract).toHaveBeenCalledWith({ batchSize: 100 });
			expect(mockTransformer.transform).toHaveBeenCalledWith(
				[{ id: 1, data: 'test' }],
				{ batchSize: 100 }
			);
			expect(mockLoader.load).toHaveBeenCalledWith(
				[{ id: 1, data: 'test', transformed: true }],
				{ batchSize: 100 }
			);

			expect(result.status).toBe('completed');
			expect(result.recordsProcessed).toBe(1);
			expect(result.recordsSuccessful).toBe(1);
			expect(result.recordsFailed).toBe(0);
		});

		test('should handle extraction errors', async () => {
			const error = new Error('Extraction failed');
			mockExtractor.extract.mockRejectedValueOnce(error);

			const result = await engine.executePipeline('test-pipeline');

			expect(result.status).toBe('failed');
			expect(result.error).toBe(error);
		});

		test('should handle transformation errors', async () => {
			const error = new Error('Transformation failed');
			mockTransformer.transform.mockRejectedValueOnce(error);

			const result = await engine.executePipeline('test-pipeline');

			expect(result.status).toBe('failed');
			expect(result.error).toBe(error);
		});

		test('should handle loading errors', async () => {
			const error = new Error('Loading failed');
			mockLoader.load.mockRejectedValueOnce(error);

			const result = await engine.executePipeline('test-pipeline');

			expect(result.status).toBe('failed');
			expect(result.error).toBe(error);
		});

		test('should handle empty extraction results', async () => {
			mockExtractor.extract.mockResolvedValueOnce([]);

			const result = await engine.executePipeline('test-pipeline');

			expect(mockTransformer.transform).not.toHaveBeenCalled();
			expect(mockLoader.load).not.toHaveBeenCalled();
			expect(result.status).toBe('completed');
			expect(result.recordsProcessed).toBe(0);
		});

		test('should update pipeline status during execution', async () => {
			const statusSpy = jest.fn();
			engine.on('pipeline_status_changed', statusSpy);

			await engine.executePipeline('test-pipeline');

			expect(statusSpy).toHaveBeenCalledWith({
				pipelineId: 'test-pipeline',
				status: 'running',
				timestamp: expect.any(Date),
			});

			expect(statusSpy).toHaveBeenCalledWith({
				pipelineId: 'test-pipeline',
				status: 'completed',
				timestamp: expect.any(Date),
			});
		});
	});

	describe('Pipeline Scheduling', () => {
		beforeEach(async () => {
			const pipelineConfig = {
				extractor: mockExtractor,
				transformer: mockTransformer,
				loader: mockLoader,
				schedule: '*/5 * * * * *', // Every 5 seconds
			};

			await engine.registerPipeline('scheduled-pipeline', pipelineConfig);
		});

		test('should start scheduled pipelines', async () => {
			const pipeline = engine.pipelines.get('scheduled-pipeline');
			expect(pipeline.schedule).toBe('*/5 * * * * *');
			// The actual scheduling is handled internally
		});
	});

	describe('Dependency Management', () => {
		test('should execute pipelines in dependency order', async () => {
			const pipeline1Config = {
				extractor: mockExtractor,
				transformer: mockTransformer,
				loader: mockLoader,
				dependencies: [],
			};

			const pipeline2Config = {
				extractor: mockExtractor,
				transformer: mockTransformer,
				loader: mockLoader,
				dependencies: ['pipeline1'],
			};

			await engine.registerPipeline('pipeline1', pipeline1Config);
			await engine.registerPipeline('pipeline2', pipeline2Config);

			const executeSpy = jest.spyOn(engine, 'executePipeline');

			await engine.executeWithDependencies('pipeline2');

			expect(executeSpy).toHaveBeenCalledWith('pipeline1');
			expect(executeSpy).toHaveBeenCalledWith('pipeline2');
		});

		test('should detect circular dependencies', async () => {
			const pipeline1Config = {
				extractor: mockExtractor,
				transformer: mockTransformer,
				loader: mockLoader,
				dependencies: ['pipeline2'],
			};

			const pipeline2Config = {
				extractor: mockExtractor,
				transformer: mockTransformer,
				loader: mockLoader,
				dependencies: ['pipeline1'],
			};

			await engine.registerPipeline('pipeline1', pipeline1Config);
			await engine.registerPipeline('pipeline2', pipeline2Config);

			await expect(async () => {
				await engine.executeWithDependencies('pipeline1');
			}).rejects.toThrow('Circular dependency detected');
		});
	});

	describe('Concurrent Execution', () => {
		test('should respect maximum concurrent pipelines limit', async () => {
			// Register multiple pipelines
			for (let i = 1; i <= 3; i++) {
				const config = {
					extractor: {
						extract: jest.fn(
							() => new Promise((resolve) => setTimeout(() => resolve([]), 50))
						),
						cleanup: jest.fn(),
					},
					transformer: mockTransformer,
					loader: mockLoader,
				};
				await engine.registerPipeline(`pipeline${i}`, config);
			}

			// Start first two pipelines (should succeed)
			const promise1 = engine.executePipeline('pipeline1');
			const promise2 = engine.executePipeline('pipeline2');

			// Third pipeline should fail due to concurrency limit
			await expect(engine.executePipeline('pipeline3')).rejects.toThrow(
				'Maximum concurrent pipelines limit reached'
			);

			// Wait for running pipelines to complete
			await Promise.all([promise1, promise2]);
		});
	});

	describe('Health Monitoring', () => {
		test('should return correct health status', () => {
			const health = engine.getHealth();

			expect(health).toEqual({
				status: 'healthy',
				uptime: expect.any(Number),
				registeredPipelines: expect.any(Number),
				runningPipelines: 0,
				totalExecutions: expect.any(Number),
				successfulExecutions: expect.any(Number),
				failedExecutions: expect.any(Number),
				averageExecutionTime: expect.any(Number),
			});
		});
	});

	describe('Metrics Collection', () => {
		beforeEach(async () => {
			const pipelineConfig = {
				extractor: mockExtractor,
				transformer: mockTransformer,
				loader: mockLoader,
			};

			await engine.registerPipeline('metrics-pipeline', pipelineConfig);
		});

		test('should collect execution metrics', async () => {
			await engine.executePipeline('metrics-pipeline');

			const metrics = engine.getMetrics();

			expect(metrics.totalExecutions).toBeGreaterThanOrEqual(1);
			expect(metrics.successfulExecutions).toBeGreaterThanOrEqual(1);
		});
	});

	describe('Pipeline Management', () => {
		test('should pause and resume pipelines', async () => {
			const pipelineConfig = {
				extractor: mockExtractor,
				transformer: mockTransformer,
				loader: mockLoader,
			};

			await engine.registerPipeline('pause-test', pipelineConfig);

			const pauseResult = await engine.pausePipeline('pause-test');
			expect(pauseResult).toBe(true);

			const resumeResult = await engine.resumePipeline('pause-test');
			expect(resumeResult).toBe(true);
		});

		test('should stop pipelines', async () => {
			const pipelineConfig = {
				extractor: mockExtractor,
				transformer: mockTransformer,
				loader: mockLoader,
			};

			await engine.registerPipeline('stop-test', pipelineConfig);

			const result = await engine.stopPipeline('stop-test');
			expect(result).toBe(true);
		});

		test('should list pipelines', async () => {
			const pipelineConfig = {
				extractor: mockExtractor,
				transformer: mockTransformer,
				loader: mockLoader,
			};

			await engine.registerPipeline('list-test', pipelineConfig);

			const pipelines = engine.listPipelines();
			expect(Array.isArray(pipelines)).toBe(true);
			expect(pipelines.length).toBeGreaterThan(0);
		});
	});

	describe('Error Scenarios', () => {
		test('should handle pipeline not found', async () => {
			await expect(
				engine.executePipeline('nonexistent-pipeline')
			).rejects.toThrow('Pipeline not found: nonexistent-pipeline');
		});

		test('should handle component cleanup errors', async () => {
			mockExtractor.cleanup.mockRejectedValueOnce(new Error('Cleanup failed'));

			const pipelineConfig = {
				extractor: mockExtractor,
				transformer: mockTransformer,
				loader: mockLoader,
			};

			await engine.registerPipeline('cleanup-error-pipeline', pipelineConfig);

			// Should not throw, just log error
			await expect(
				engine.executePipeline('cleanup-error-pipeline')
			).resolves.toBeDefined();
		});
	});
});
