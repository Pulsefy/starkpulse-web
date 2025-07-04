const express = require('express');
const proxyService = require('../services/proxyService');
const { limiter } = require('../middleware/rateLimiter');
const { requireAuth } = require('../middleware/auth'); // ✅ FIXED

const router = express.Router();

router.use(limiter);
router.use(requireAuth); // ✅ USE A FUNCTION

router.use('/users', proxyService('http://localhost:3001'));
router.use('/projects', proxyService('http://localhost:3002'));

module.exports = router;
