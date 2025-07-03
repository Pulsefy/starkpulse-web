/**
 * API Documentation Routes
 * Provides version-specific API documentation
 */
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const router = express.Router();
const { getVersions, getLatestVersion } = require('../../middleware/versionHandler');

// Serve API versioning guide
router.get('/', (req, res) => {
  const docPath = path.join(__dirname, '../../../docs/API_VERSIONING.md');
  
  try {
    const content = fs.readFileSync(docPath, 'utf8');
    res.format({
      'text/plain': () => {
        res.send(content);
      },
      'text/html': () => {
        // Simple markdown to HTML conversion
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>API Versioning Guide</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown.min.css">
            <style>
              .markdown-body {
                box-sizing: border-box;
                min-width: 200px;
                max-width: 980px;
                margin: 0 auto;
                padding: 45px;
              }
              @media (max-width: 767px) {
                .markdown-body {
                  padding: 15px;
                }
              }
            </style>
          </head>
          <body class="markdown-body">
            <div id="content">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>').replace(/# (.*)/g, '<h1>$1</h1>').replace(/## (.*)/g, '<h2>$1</h2>').replace(/### (.*)/g, '<h3>$1</h3>')}</div>
            <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
            <script>
              document.getElementById('content').innerHTML = marked.parse(document.getElementById('content').innerText);
            </script>
          </body>
          </html>
        `;
        res.send(htmlContent);
      },
      'default': () => {
        res.send(content);
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Documentation not available',
      error: error.message
    });
  }
});

// Version-specific documentation
router.get('/:version', (req, res) => {
  const { version } = req.params;
  const validVersions = Object.keys(getVersions());
  
  if (!validVersions.includes(version)) {
    return res.status(400).json({
      success: false,
      message: `Invalid version: ${version}. Available versions: ${validVersions.join(', ')}`
    });
  }
  
  // In a real app, you would serve version-specific docs
  // For now, we'll return basic version info
  res.json({
    version,
    isLatest: version === getLatestVersion(),
    endpoints: [
      { path: `/api/${version}/auth`, methods: ['POST'], description: 'Authentication endpoints' },
      { path: `/api/${version}/users`, methods: ['GET', 'POST', 'PUT', 'DELETE'], description: 'User management' },
      { path: `/api/${version}/crypto`, methods: ['GET'], description: 'Cryptocurrency data' },
      // Add more endpoint documentation as needed
    ],
    links: {
      versioning_guide: '/api/docs',
      migration_guide: version !== getLatestVersion() ? `/api/docs/migration/${version}-to-${getLatestVersion()}` : null
    }
  });
});

// Migration guides
router.get('/migration/:path', (req, res) => {
  const { path } = req.params;
  const [fromVersion, toVersion] = path.split('-to-');
  
  res.json({
    migration_guide: {
      from: fromVersion,
      to: toVersion,
      steps: [
        'Update API endpoints in your client code',
        'Review response formats as some responses may include additional fields',
        'Test all endpoints thoroughly with the new version'
      ],
      breaking_changes: [
        {
          endpoint: `/${fromVersion}/users/profile`,
          change: `In ${toVersion}, user profile includes additional nested fields`,
          mitigation: 'Use the backward compatibility mode with ?compat=true'
        }
      ],
      support: 'dev-support@starkpulse.com'
    }
  });
});

module.exports = router;
