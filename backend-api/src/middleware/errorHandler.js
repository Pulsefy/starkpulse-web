// Global error handling middleware
module.exports = (err, req, res, next) => { res.status(500).json({ error: err.message }); };
