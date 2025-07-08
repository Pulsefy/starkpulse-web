// Add search endpoints to v1 API
const express = require('express');
const router = express.Router();

router.use('/search', require('../../routes/search'));

module.exports = router;
