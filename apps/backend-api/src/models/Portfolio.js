const mongoose = require('mongoose');
const SearchService = require('../services/searchService');

const assetSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  buyPrice: {
    type: Number,
    required: true,
    min: 0
  },
  buyDate: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true
  }
}, { _id: false });

const portfolioSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  assets: [assetSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

portfolioSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

portfolioSchema.post('save', async function(doc) {
  try {
    await SearchService.indexDocument('portfolio', doc._id.toString(), doc.toObject());
  } catch (err) {
    console.error('Elasticsearch index error (Portfolio):', err);
  }
});

portfolioSchema.post('remove', async function(doc) {
  try {
    await SearchService.removeDocument('portfolio', doc._id.toString());
  } catch (err) {
    console.error('Elasticsearch remove error (Portfolio):', err);
  }
});

module.exports = mongoose.model('Portfolio', portfolioSchema);