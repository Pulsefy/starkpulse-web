const express = require('express');
const router = express.Router();
const ctrl = require('../controller/analytics.controller');

router.get('/users', ctrl.getUserAnalytics);
router.get('/portfolio', ctrl.getPortfolioAnalytics);
router.get('/platform', ctrl.getPlatformMetrics);
router.get('/export', ctrl.exportData);

module.exports = router;