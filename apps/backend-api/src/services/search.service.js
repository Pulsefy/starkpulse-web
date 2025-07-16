// Service for advanced search, faceted filtering, auto-complete, and analytics using Elasticsearch
const elasticClient = require('./elasticClient');

const NEWS_INDEX = 'news';
const PORTFOLIO_INDEX = 'portfolio';
const USER_INDEX = 'users';

const searchService = {
  // Full-text search with faceted filtering
  async search({ index, query, filters = {}, from = 0, size = 20 }) {
    const must = [];
    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['title^3', 'content', 'summary', 'tags', 'categories', 'coins', 'username', 'email', 'assetName'],
          fuzziness: 'AUTO',
        },
      });
    }
    // Faceted filters
    Object.entries(filters).forEach(([field, value]) => {
      if (value) {
        must.push({ term: { [field]: value } });
      }
    });
    const body = {
      query: {
        bool: { must },
      },
      from,
      size,
    };
    const { body: result } = await elasticClient.search({ index, body });
    return result.hits.hits.map(hit => hit._source);
  },

  // Auto-complete suggestions
  async suggest({ index, field, prefix, size = 5 }) {
    const body = {
      suggest: {
        autocomplete: {
          prefix,
          completion: {
            field,
            size,
          },
        },
      },
    };
    const { body: result } = await elasticClient.search({ index, body });
    return result.suggest.autocomplete[0].options.map(opt => opt.text);
  },

  // Index a document
  async indexDocument({ index, id, body }) {
    return elasticClient.index({ index, id, body });
  },

  // Track search analytics (basic example)
  async trackSearch({ userId, query, filters, timestamp = new Date() }) {
    return elasticClient.index({
      index: 'search-analytics',
      body: { userId, query, filters, timestamp },
    });
  },
};

module.exports = searchService;
