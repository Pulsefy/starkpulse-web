// Backfill script: Sync all MongoDB data to Elasticsearch
const mongoose = require('mongoose');
const News = require('../src/models/News');
const Portfolio = require('../src/models/Portfolio');
const User = require('../src/models/User');
const SearchService = require('../src/services/searchService');
require('dotenv').config();

async function backfill() {
  await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  // News
  const news = await News.find();
  for (const doc of news) {
    await SearchService.indexDocument('news', doc._id.toString(), doc.toObject());
  }
  console.log(`Indexed ${news.length} news articles.`);

  // Portfolio
  const portfolios = await Portfolio.find();
  for (const doc of portfolios) {
    await SearchService.indexDocument('portfolio', doc._id.toString(), doc.toObject());
  }
  console.log(`Indexed ${portfolios.length} portfolios.`);

  // User
  const users = await User.find();
  for (const doc of users) {
    await SearchService.indexDocument('user', doc._id.toString(), doc.toObject());
  }
  console.log(`Indexed ${users.length} users.`);

  await mongoose.disconnect();
  console.log('Backfill complete.');
}

backfill().catch(err => {
  console.error('Backfill error:', err);
  process.exit(1);
});
