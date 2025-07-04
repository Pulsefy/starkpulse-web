/**
 * Simple test script for API versioning middleware
 * Run with: node testVersioning.js
 */
const express = require('express');
const { versionHandler, API_VERSIONS } = require('./src/middleware/versionHandler');

// Create a minimal Express app
const app = express();
const PORT = 3333;

// Apply the version handler middleware
app.use('/api', versionHandler);

// Create some test routes
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Default version route',
    detectedVersion: req.apiVersion
  });
});

app.get('/api/v1/test', (req, res) => {
  res.json({
    message: 'Version 1 specific route',
    detectedVersion: req.apiVersion
  });
});

app.get('/api/v2/test', (req, res) => {
  res.json({
    message: 'Version 2 specific route',
    detectedVersion: req.apiVersion
  });
});

// Add endpoint to check API version status
app.get('/api/versions', (req, res) => {
  res.json({
    versions: API_VERSIONS,
    defaultVersion: req.apiVersion
  });
});

// Test endpoint with a non-existent version
app.get('/api/v99/test', (req, res) => {
  res.json({
    message: 'This should not be reached - invalid version',
    detectedVersion: req.apiVersion
  });
});

/**
 * Create a special middleware to test deprecation headers
 * We need to apply this BEFORE any requests are processed
 */
app.get('/api/test-deprecation-toggle', (req, res) => {
  const enable = req.query.enable === 'true';
  const version = req.query.version || 'v1';
  
  if (enable) {
    console.log(`Marking ${version} as deprecated with sunset date 2025-12-31`);
    API_VERSIONS[version].deprecated = true;
    API_VERSIONS[version].sunset = '2025-12-31';
  } else {
    console.log(`Marking ${version} as not deprecated`);
    API_VERSIONS[version].deprecated = false;
    API_VERSIONS[version].sunset = null;
  }
  
  res.json({
    success: true,
    version: version,
    deprecated: API_VERSIONS[version].deprecated,
    message: `API version ${version} deprecated status set to: ${API_VERSIONS[version].deprecated}`
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
  console.log('\nTest endpoints:');
  console.log(`- Default version: http://localhost:${PORT}/api/test`);
  console.log(`- Version 1: http://localhost:${PORT}/api/v1/test`);
  console.log(`- Version 2: http://localhost:${PORT}/api/v2/test`);
  console.log(`- Invalid version (should return 400): http://localhost:${PORT}/api/v99/test`);
  console.log(`- Check versions: http://localhost:${PORT}/api/versions`);
  console.log(`- Deprecation test: http://localhost:${PORT}/api/deprecation-test`);
  console.log('\nPress Ctrl+C to stop the server');
});
