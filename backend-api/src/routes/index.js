// Main router setup
const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/users', require('./users'));
router.use('/news', require('./news'));
router.use('/crypto', require('./crypto'));
router.use('/portfolio', require('./portfolio'));
router.use('/starknet', require('./starknet'));
router.use('/health', require('./health'));

module.exports = router;
