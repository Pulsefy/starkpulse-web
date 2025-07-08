// SearchService: Handles full-text, faceted, auto-complete, and analytics for News, Portfolio, User
const esClient = require('./esClient');

class SearchService {
  static async indexDocument(index, id, body) {
    return esClient.index({ index, id, body });
  }

  static async removeDocument(index, id) {
    return esClient.delete({ index, id });
  }

  static async search(index, query, filters = {}, from = 0, size = 10) {
    const esQuery = {
      bool: {
        must: query ? [{ multi_match: { query, fields: ['title^3', 'content', 'summary', 'name', 'email'] } }] : [],
        filter: Object.entries(filters).map(([field, value]) => ({ term: { [field]: value } })),
      },
    };
    return esClient.search({
      index,
      from,
      size,
      body: { query: esQuery },
    });
  }

  static async autoComplete(index, field, prefix, size = 5) {
    return esClient.search({
      index,
      size,
      body: {
        suggest: {
          autocomplete: {
            prefix,
            completion: { field, fuzzy: { fuzziness: 1 } },
          },
        },
      },
    });
  }

  static async logSearchAnalytics(query, userId) {
    return esClient.index({
      index: 'search-analytics',
      body: { query, userId, timestamp: new Date() },
    });
  }
}

module.exports = SearchService;
