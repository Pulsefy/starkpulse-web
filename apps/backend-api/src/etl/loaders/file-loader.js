/**
 * File Loader
 * Loads data into various file formats with compression and partitioning
 */

const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const BaseLoader = require('./base-loader');
const logger = require('../../utils/logger');

const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);

class FileLoader extends BaseLoader {
	constructor(config = {}) {
		super(config);
		this.config = {
			...this.config,
			outputPath: config.outputPath || './data/output',
			fileFormat: config.fileFormat || 'json', // json, csv, parquet, avro
			compression: {
				enabled: config.compressionEnabled !== false,
				algorithm: config.compressionAlgorithm || 'gzip', // gzip, deflate, brotli
				level: config.compressionLevel || 6,
			},
			partitioning: {
				enabled: config.partitioningEnabled || false,
				strategy: config.partitionStrategy || 'date', // date, size, hash, custom
				field: config.partitionField || 'timestamp',
				maxSize: config.maxPartitionSize || 100 * 1024 * 1024, // 100MB
				maxRecords: config.maxPartitionRecords || 1000000,
			},
			naming: {
				template: config.namingTemplate || '{timestamp}_{partition}_{format}',
				timestampFormat: config.timestampFormat || 'YYYY-MM-DD_HH-mm-ss',
				includeMetadata: config.includeMetadata !== false,
			},
			encoding: config.encoding || 'utf8',
			formatting: {
				indent: config.formatIndent || 2,
				includeHeaders: config.includeHeaders !== false,
				dateFormat: config.dateFormat || 'ISO8601',
				nullValue: config.nullValue || '',
			},
		};

		this.currentPartition = null;
		this.partitionStats = new Map();
		this.writers = new Map();
	}

	/**
	 * Initialize the file loader
	 */
	async initializeLoader() {
		// Ensure output directory exists
		await this.ensureDirectoryExists(this.config.outputPath);

		// Initialize partitioning if enabled
		if (this.config.partitioning.enabled) {
			await this.initializePartitioning();
		}

		// Validate file format support
		this.validateFileFormat();

		logger.info(
			`File loader initialized for format: ${this.config.fileFormat}`
		);
	}

	/**
	 * Ensure directory exists
	 */
	async ensureDirectoryExists(dirPath) {
		try {
			await fs.access(dirPath);
		} catch (error) {
			if (error.code === 'ENOENT') {
				await fs.mkdir(dirPath, { recursive: true });
				logger.info(`Created directory: ${dirPath}`);
			} else {
				throw error;
			}
		}
	}

	/**
	 * Initialize partitioning
	 */
	async initializePartitioning() {
		switch (this.config.partitioning.strategy) {
			case 'date':
				this.partitionFunction = this.datePartitionFunction.bind(this);
				break;
			case 'size':
				this.partitionFunction = this.sizePartitionFunction.bind(this);
				break;
			case 'hash':
				this.partitionFunction = this.hashPartitionFunction.bind(this);
				break;
			case 'custom':
				if (!this.config.customPartitionFunction) {
					throw new Error(
						'Custom partition function is required when using custom partitioning'
					);
				}
				this.partitionFunction = this.config.customPartitionFunction;
				break;
			default:
				throw new Error(
					`Unsupported partitioning strategy: ${this.config.partitioning.strategy}`
				);
		}
	}

	/**
	 * Validate file format support
	 */
	validateFileFormat() {
		const supportedFormats = ['json', 'csv', 'jsonl', 'xml', 'yaml'];

		if (!supportedFormats.includes(this.config.fileFormat)) {
			throw new Error(`Unsupported file format: ${this.config.fileFormat}`);
		}
	}

	/**
	 * Load a single record
	 */
	async loadRecord(record) {
		try {
			const partition = this.config.partitioning.enabled
				? await this.getPartitionForRecord(record)
				: 'default';

			const writer = await this.getWriterForPartition(partition);
			await this.writeRecordToFile(writer, record);

			// Update partition stats
			const stats = this.partitionStats.get(partition) || {
				records: 0,
				size: 0,
			};
			stats.records++;
			stats.size += this.estimateRecordSize(record);
			this.partitionStats.set(partition, stats);

			return { written: true, partition };
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
			return { successful: 0, failed: 0, partitions: [] };
		}

		const results = {
			successful: 0,
			failed: 0,
			partitions: new Set(),
		};

		// Group records by partition if partitioning is enabled
		const partitionGroups = this.config.partitioning.enabled
			? await this.groupRecordsByPartition(records)
			: new Map([['default', records]]);

		// Process each partition group
		for (const [partition, partitionRecords] of partitionGroups) {
			try {
				const writer = await this.getWriterForPartition(partition);
				const partitionResult = await this.writeRecordsToFile(
					writer,
					partitionRecords
				);

				results.successful += partitionResult.successful;
				results.failed += partitionResult.failed;
				results.partitions.add(partition);

				// Update partition stats
				const stats = this.partitionStats.get(partition) || {
					records: 0,
					size: 0,
				};
				stats.records += partitionResult.successful;
				stats.size += partitionRecords.reduce(
					(sum, record) => sum + this.estimateRecordSize(record),
					0
				);
				this.partitionStats.set(partition, stats);
			} catch (error) {
				logger.error(`Failed to write to partition ${partition}:`, error);
				results.failed += partitionRecords.length;

				if (!this.config.continueOnError) {
					throw error;
				}
			}
		}

		return {
			successful: results.successful,
			failed: results.failed,
			partitions: Array.from(results.partitions),
		};
	}

	/**
	 * Group records by partition
	 */
	async groupRecordsByPartition(records) {
		const groups = new Map();

		for (const record of records) {
			const partition = await this.getPartitionForRecord(record);

			if (!groups.has(partition)) {
				groups.set(partition, []);
			}

			groups.get(partition).push(record);
		}

		return groups;
	}

	/**
	 * Get partition for record
	 */
	async getPartitionForRecord(record) {
		return await this.partitionFunction(record);
	}

	/**
	 * Date partition function
	 */
	datePartitionFunction(record) {
		const moment = require('moment');
		const dateField = this.config.partitioning.field;
		const date = record[dateField] ? new Date(record[dateField]) : new Date();

		return moment(date).format('YYYY-MM-DD');
	}

	/**
	 * Size partition function
	 */
	sizePartitionFunction(record) {
		// Find current partition that hasn't exceeded size limit
		for (const [partition, stats] of this.partitionStats) {
			if (
				stats.size < this.config.partitioning.maxSize &&
				stats.records < this.config.partitioning.maxRecords
			) {
				return partition;
			}
		}

		// Create new partition
		const timestamp = Date.now();
		return `partition_${timestamp}`;
	}

	/**
	 * Hash partition function
	 */
	hashPartitionFunction(record) {
		const crypto = require('crypto');
		const hashField = this.config.partitioning.field;
		const value = record[hashField] || JSON.stringify(record);

		const hash = crypto.createHash('md5').update(value).digest('hex');
		const partitionCount = this.config.partitioning.partitionCount || 10;
		const partitionIndex = parseInt(hash.substring(0, 8), 16) % partitionCount;

		return `partition_${partitionIndex}`;
	}

	/**
	 * Get writer for partition
	 */
	async getWriterForPartition(partition) {
		if (this.writers.has(partition)) {
			return this.writers.get(partition);
		}

		const writer = await this.createWriter(partition);
		this.writers.set(partition, writer);

		return writer;
	}

	/**
	 * Create writer for partition
	 */
	async createWriter(partition) {
		const filename = this.generateFilename(partition);
		const filepath = path.join(this.config.outputPath, filename);

		const writer = {
			partition,
			filepath,
			stream: null,
			isFirstRecord: true,
			recordCount: 0,
		};

		// Create write stream
		writer.stream = await this.createWriteStream(filepath);

		// Write file header if needed
		await this.writeFileHeader(writer);

		return writer;
	}

	/**
	 * Create write stream
	 */
	async createWriteStream(filepath) {
		let stream = require('fs').createWriteStream(filepath, {
			encoding: this.config.encoding,
		});

		// Add compression if enabled
		if (this.config.compression.enabled) {
			const compressionStream = this.createCompressionStream();
			compressionStream.pipe(stream);
			stream = compressionStream;
		}

		return stream;
	}

	/**
	 * Create compression stream
	 */
	createCompressionStream() {
		const level = this.config.compression.level;

		switch (this.config.compression.algorithm) {
			case 'gzip':
				return zlib.createGzip({ level });
			case 'deflate':
				return zlib.createDeflate({ level });
			case 'brotli':
				return zlib.createBrotliCompress({
					params: { [zlib.constants.BROTLI_PARAM_QUALITY]: level },
				});
			default:
				throw new Error(
					`Unsupported compression algorithm: ${this.config.compression.algorithm}`
				);
		}
	}

	/**
	 * Generate filename
	 */
	generateFilename(partition) {
		const moment = require('moment');
		const timestamp = moment().format(this.config.naming.timestampFormat);
		const extension = this.getFileExtension();

		let filename = this.config.naming.template
			.replace('{timestamp}', timestamp)
			.replace('{partition}', partition)
			.replace('{format}', this.config.fileFormat);

		return `${filename}${extension}`;
	}

	/**
	 * Get file extension
	 */
	getFileExtension() {
		let extension = `.${this.config.fileFormat}`;

		if (this.config.compression.enabled) {
			switch (this.config.compression.algorithm) {
				case 'gzip':
					extension += '.gz';
					break;
				case 'deflate':
					extension += '.deflate';
					break;
				case 'brotli':
					extension += '.br';
					break;
			}
		}

		return extension;
	}

	/**
	 * Write file header
	 */
	async writeFileHeader(writer) {
		switch (this.config.fileFormat) {
			case 'json':
				await this.writeToStream(writer.stream, '[\n');
				break;
			case 'csv':
				if (this.config.formatting.includeHeaders && this.config.csvHeaders) {
					const headers = this.config.csvHeaders.join(',') + '\n';
					await this.writeToStream(writer.stream, headers);
				}
				break;
			case 'xml':
				await this.writeToStream(
					writer.stream,
					'<?xml version="1.0" encoding="UTF-8"?>\n<records>\n'
				);
				break;
			case 'yaml':
				await this.writeToStream(writer.stream, '---\n');
				break;
		}
	}

	/**
	 * Write record to file
	 */
	async writeRecordToFile(writer, record) {
		let content = '';

		switch (this.config.fileFormat) {
			case 'json':
				content = this.formatJsonRecord(writer, record);
				break;
			case 'jsonl':
				content = this.formatJsonlRecord(record);
				break;
			case 'csv':
				content = this.formatCsvRecord(record);
				break;
			case 'xml':
				content = this.formatXmlRecord(record);
				break;
			case 'yaml':
				content = this.formatYamlRecord(record);
				break;
		}

		await this.writeToStream(writer.stream, content);
		writer.recordCount++;
		writer.isFirstRecord = false;
	}

	/**
	 * Write records to file
	 */
	async writeRecordsToFile(writer, records) {
		let successful = 0;
		let failed = 0;

		for (const record of records) {
			try {
				await this.writeRecordToFile(writer, record);
				successful++;
			} catch (error) {
				failed++;
				logger.error('Failed to write record:', error);

				if (!this.config.continueOnError) {
					throw error;
				}
			}
		}

		return { successful, failed };
	}

	/**
	 * Format JSON record
	 */
	formatJsonRecord(writer, record) {
		const jsonString = JSON.stringify(
			record,
			null,
			this.config.formatting.indent
		);
		const prefix = writer.isFirstRecord ? '' : ',\n';
		return `${prefix}  ${jsonString}`;
	}

	/**
	 * Format JSONL record
	 */
	formatJsonlRecord(record) {
		return JSON.stringify(record) + '\n';
	}

	/**
	 * Format CSV record
	 */
	formatCsvRecord(record) {
		const values = this.config.csvHeaders
			? this.config.csvHeaders.map((header) =>
					this.formatCsvValue(record[header])
			  )
			: Object.values(record).map((value) => this.formatCsvValue(value));

		return values.join(',') + '\n';
	}

	/**
	 * Format CSV value
	 */
	formatCsvValue(value) {
		if (value === null || value === undefined) {
			return this.config.formatting.nullValue;
		}

		if (
			typeof value === 'string' &&
			(value.includes(',') || value.includes('"') || value.includes('\n'))
		) {
			return `"${value.replace(/"/g, '""')}"`;
		}

		if (value instanceof Date) {
			return this.config.formatting.dateFormat === 'ISO8601'
				? value.toISOString()
				: value.toString();
		}

		return String(value);
	}

	/**
	 * Format XML record
	 */
	formatXmlRecord(record) {
		const xml = this.objectToXml(record, 'record');
		return `  ${xml}\n`;
	}

	/**
	 * Convert object to XML
	 */
	objectToXml(obj, rootElement = 'root') {
		let xml = `<${rootElement}>`;

		for (const [key, value] of Object.entries(obj)) {
			if (value === null || value === undefined) {
				xml += `<${key}/>`;
			} else if (typeof value === 'object' && !Array.isArray(value)) {
				xml += this.objectToXml(value, key);
			} else if (Array.isArray(value)) {
				for (const item of value) {
					xml += this.objectToXml(item, key);
				}
			} else {
				xml += `<${key}>${this.escapeXml(String(value))}</${key}>`;
			}
		}

		xml += `</${rootElement}>`;
		return xml;
	}

	/**
	 * Escape XML special characters
	 */
	escapeXml(text) {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}

	/**
	 * Format YAML record
	 */
	formatYamlRecord(record) {
		const yaml = require('js-yaml');
		return yaml.dump([record], { indent: this.config.formatting.indent });
	}

	/**
	 * Write to stream
	 */
	async writeToStream(stream, content) {
		return new Promise((resolve, reject) => {
			stream.write(content, this.config.encoding, (error) => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			});
		});
	}

	/**
	 * Check existing records (not applicable for file loading)
	 */
	async checkExistingRecords(records) {
		return [];
	}

	/**
	 * Create index (not applicable for file loading)
	 */
	async createIndex(indexConfig) {
		// Create metadata index file if configured
		if (this.config.naming.includeMetadata) {
			await this.createMetadataIndex(indexConfig);
		}
	}

	/**
	 * Create metadata index
	 */
	async createMetadataIndex(indexConfig) {
		const indexPath = path.join(this.config.outputPath, 'metadata_index.json');
		const metadata = {
			timestamp: new Date().toISOString(),
			format: this.config.fileFormat,
			compression: this.config.compression,
			partitions: Array.from(this.partitionStats.entries()).map(
				([partition, stats]) => ({
					partition,
					records: stats.records,
					estimatedSize: stats.size,
				})
			),
			index: indexConfig,
		};

		await fs.writeFile(indexPath, JSON.stringify(metadata, null, 2));
		logger.info('Metadata index created');
	}

	/**
	 * Perform archival
	 */
	async performArchival(cutoffDate) {
		let archivedCount = 0;
		const archivePath = path.join(this.config.outputPath, 'archive');

		await this.ensureDirectoryExists(archivePath);

		// Move old files to archive directory
		const files = await fs.readdir(this.config.outputPath);

		for (const file of files) {
			const filePath = path.join(this.config.outputPath, file);
			const stats = await fs.stat(filePath);

			if (stats.isFile() && stats.mtime < cutoffDate) {
				const archiveFilePath = path.join(archivePath, file);
				await fs.rename(filePath, archiveFilePath);
				archivedCount++;
				logger.info(`Archived file: ${file}`);
			}
		}

		return archivedCount;
	}

	/**
	 * Estimate record size
	 */
	estimateRecordSize(record) {
		return JSON.stringify(record).length * 2; // Rough estimate including formatting
	}

	/**
	 * Write file footer
	 */
	async writeFileFooter(writer) {
		switch (this.config.fileFormat) {
			case 'json':
				await this.writeToStream(writer.stream, '\n]');
				break;
			case 'xml':
				await this.writeToStream(writer.stream, '</records>');
				break;
		}
	}

	/**
	 * Clean up resources
	 */
	async cleanupLoader() {
		// Close all writers
		for (const [partition, writer] of this.writers) {
			try {
				// Write file footer if needed
				await this.writeFileFooter(writer);

				// Close stream
				await new Promise((resolve, reject) => {
					writer.stream.end((error) => {
						if (error) {
							reject(error);
						} else {
							resolve();
						}
					});
				});

				logger.info(
					`Closed writer for partition: ${partition} (${writer.recordCount} records)`
				);
			} catch (error) {
				logger.error(`Error closing writer for partition ${partition}:`, error);
			}
		}

		this.writers.clear();

		// Write final metadata
		if (this.config.naming.includeMetadata) {
			await this.writeFinalMetadata();
		}

		logger.info('File loader cleanup completed');
	}

	/**
	 * Write final metadata
	 */
	async writeFinalMetadata() {
		const metadataPath = path.join(
			this.config.outputPath,
			'load_metadata.json'
		);
		const metadata = {
			timestamp: new Date().toISOString(),
			format: this.config.fileFormat,
			compression: this.config.compression,
			partitioning: this.config.partitioning,
			totalRecords: Array.from(this.partitionStats.values()).reduce(
				(sum, stats) => sum + stats.records,
				0
			),
			totalEstimatedSize: Array.from(this.partitionStats.values()).reduce(
				(sum, stats) => sum + stats.size,
				0
			),
			partitions: Array.from(this.partitionStats.entries()).map(
				([partition, stats]) => ({
					partition,
					records: stats.records,
					estimatedSize: stats.size,
				})
			),
		};

		await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
		logger.info('Final metadata written');
	}
}

module.exports = FileLoader;
