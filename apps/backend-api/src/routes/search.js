// API routes for advanced search, filtering, auto-complete, and analytics
const express = require('express');
const router = express.Router();
const searchService = require('../services/search.service');

// News search endpoint
router.get('/news', async (req, res) => {
  const { q, ...filters } = req.query;
  try {
    const results = await searchService.search({
      index: 'news',
      query: q,
      filters,
      from: parseInt(req.query.from) || 0,
      size: parseInt(req.query.size) || 20,
    });
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

// Portfolio search endpoint
router.get('/portfolio', async (req, res) => {
  const { q, ...filters } = req.query;
  try {
    const results = await searchService.search({
      index: 'portfolio',
      query: q,
      filters,
      from: parseInt(req.query.from) || 0,
      size: parseInt(req.query.size) || 20,
    });
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

// User search endpoint
router.get('/users', async (req, res) => {
  const { q, ...filters } = req.query;
  try {
    const results = await searchService.search({
      index: 'users',
      query: q,
      filters,
      from: parseInt(req.query.from) || 0,
      size: parseInt(req.query.size) || 20,
    });
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

// Auto-complete endpoint
router.get('/suggest', async (req, res) => {
  const { index, field, prefix } = req.query;
  try {
    const suggestions = await searchService.suggest({ index, field, prefix });
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: 'Suggestion failed', details: err.message });
  }
});

// Search analytics endpoint (basic example)
router.post('/analytics', async (req, res) => {
  try {
    await searchService.trackSearch(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Analytics tracking failed', details: err.message });
  }
});

module.exports = router;
