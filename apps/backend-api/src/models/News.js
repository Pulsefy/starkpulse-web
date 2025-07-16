const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'News title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
      index: true
    },
    content: {
      type: String,
      required: [true, 'News content is required']
    },
    summary: {
      type: String,
      trim: true,
      maxlength: [500, 'Summary cannot exceed 500 characters']
    },
    url: {
      type: String,
      required: [true, 'Source URL is required'],
      trim: true,
      unique: true
    },
    imageUrl: {
      type: String,
      trim: true
    },
    source: {
      name: {
        type: String,
        required: [true, 'Source name is required'],
        trim: true,
        index: true
      },
      url: {
        type: String,
        trim: true
      }
    },
    author: {
      type: String,
      trim: true
    },
    publishedAt: {
      type: Date,
      required: true,
      index: true
    },
    categories: [{
      type: String,
      trim: true,
      lowercase: true,
      index: true
    }],
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
      index: true
    }],
    coins: [{
      type: String,
      trim: true,
      lowercase: true,
      index: true
    }],
    sentiment: {
      type: String,
      enum: ['positive', 'negative', 'neutral'],
      default: 'neutral',
      index: true
    },
    popularity: {
      type: Number,
      default: 0,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    fetchedFrom: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        // Use undefined assignment instead of delete operator for better performance
        ret.__v = undefined;
        return ret;
      }
    }
  }
);

// Indexes for efficient querying
newsSchema.index({ publishedAt: -1 });
newsSchema.index({ popularity: -1 });
newsSchema.index({ 'source.name': 1, publishedAt: -1 });
newsSchema.index({ categories: 1, publishedAt: -1 });
newsSchema.index({ tags: 1, publishedAt: -1 });
newsSchema.index({ coins: 1, publishedAt: -1 });
newsSchema.index({ title: 'text', content: 'text', summary: 'text' });

// Static method to search news articles
newsSchema.statics.searchNews = function(query, options = {}) {
  const searchCriteria = {};
  
  // Add text search if provided
  if (query.searchTerm) {
    searchCriteria.$text = { $search: query.searchTerm };
  }
  
  // Filter by source
  if (query.source) {
    searchCriteria['source.name'] = query.source;
  }
  
  // Filter by category
  if (query.category) {
    searchCriteria.categories = query.category.toLowerCase();
  }
  
  // Filter by tag
  if (query.tag) {
    searchCriteria.tags = query.tag.toLowerCase();
  }
  
  // Filter by coin
  if (query.coin) {
    searchCriteria.coins = query.coin.toLowerCase();
  }
  
  // Filter by sentiment
  if (query.sentiment) {
    searchCriteria.sentiment = query.sentiment;
  }
  
  // Filter by date range
  if (query.fromDate || query.toDate) {
    searchCriteria.publishedAt = {};
    
    if (query.fromDate) {
      searchCriteria.publishedAt.$gte = new Date(query.fromDate);
    }
    
    if (query.toDate) {
      searchCriteria.publishedAt.$lte = new Date(query.toDate);
    }
  }
  
  // Only return active news
  if (!query.includeInactive) {
    searchCriteria.isActive = true;
  }
  
  // Set up pagination
  const page = Number.parseInt(options.page, 10) || 1;
  const limit = Number.parseInt(options.limit, 10) || 20;
  const skip = (page - 1) * limit;
  
  // Set up sorting
  const sortField = options.sortField || 'publishedAt';
  const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
  const sort = { [sortField]: sortOrder };
  
  // If text search is being used, sort by score first
  if (query.searchTerm) {
    sort.score = { $meta: 'textScore' };
  }
  
  return this.find(searchCriteria)
    .select(options.fields || '')
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
};


// Elasticsearch indexing hook (non-intrusive)
const searchService = require('../services/search.service');
newsSchema.post('save', function(doc) {
  searchService.indexDocument({
    index: 'news',
    id: doc._id.toString(),
    body: doc.toObject(),
  }).catch(() => {}); // Fail silently to avoid breaking save
});

module.exports = mongoose.model('News', newsSchema);
