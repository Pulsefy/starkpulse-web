const express = require('express');
const SearchService = require('../services/searchService');
const router = express.Router();

// General search endpoint
router.get('/', async (req, res) => {
  const { type, q, ...filters } = req.query;
  if (!type || !['news', 'portfolio', 'user'].includes(type)) {
    return res.status(400).json({ error: 'Invalid or missing type parameter' });
  }
  try {
    const result = await SearchService.search(type, q, filters);
    await SearchService.logSearchAnalytics(q, req.user?._id);
    res.json(result.body.hits.hits.map(hit => hit._source));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-complete endpoint
router.get('/autocomplete', async (req, res) => {
  const { type, field, prefix } = req.query;
  if (!type || !field || !prefix) {
    return res.status(400).json({ error: 'Missing parameters' });
  }
  try {
    const result = await SearchService.autoComplete(type, field, prefix);
    res.json(result.body.suggest.autocomplete[0].options.map(opt => opt.text));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
