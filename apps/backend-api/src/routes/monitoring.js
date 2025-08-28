// Express route for monitoring system status and events
const express = require('express');
const router = express.Router();
const monitor = require('../monitoring');
const monitorController = require('../controllers/monitorController');

// Endpoint to get monitoring status
router.get('/status', (req, res) => {
  res.json({ status: 'monitoring active', networks: monitor.networkConfigs });
});

// Endpoint to get recent suspicious transactions (stub)
router.get('/suspicious', (req, res) => {
  // Replace with actual suspicious transaction retrieval
  res.json({ suspicious: [] });
});

router.get("/monitor", monitorController.getQueueStats);



module.exports = router;
