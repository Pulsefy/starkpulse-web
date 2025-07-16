// Elasticsearch client setup for advanced search features
const { Client } = require('@elastic/elasticsearch');

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

const elasticClient = new Client({ node: ELASTICSEARCH_URL });

module.exports = elasticClient;
