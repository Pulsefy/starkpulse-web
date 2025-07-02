const { createProxyMiddleware } = require('http-proxy-middleware');

const servicePools = {
  'http://localhost:3001': ['http://localhost:3001', 'http://localhost:3003'],
  'http://localhost:3002': ['http://localhost:3002']
};

const counters = {};

function getNextTarget(baseUrl) {
  const pool = servicePools[baseUrl];
  if (!counters[baseUrl]) counters[baseUrl] = 0;
  const index = counters[baseUrl];
  counters[baseUrl] = (index + 1) % pool.length;
  return pool[index];
}

const proxyService = (baseUrl) => {
  return createProxyMiddleware({
    target: baseUrl,
    changeOrigin: true,
    router: () => getNextTarget(baseUrl),
    pathRewrite: (path, req) => path.replace(/^\/api/, ''),
    onError: (err, req, res) => {
      console.error('Proxy error:', err);
      res.status(502).send('Bad Gateway');
    },
  });
};

module.exports = proxyService;
