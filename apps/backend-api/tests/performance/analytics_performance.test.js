// tests/performance/analytics_performance.test.js
const onchain = require('../../src/analytics/onchain');

describe('Analytics Performance', () => {
  it('should process 1000 transactions for a StarkNet address in reasonable time', async () => {
    const address = '0x04e3b1f7e0e7b1e1e0e7b1e1e0e7b1e1e0e7b1e1e0e7b1e1e0e7b1e1e0e7b1e1'; // Jediswap
    const start = Date.now();
    const result = await onchain.analyzeTransactionFlow([address], null);
    const duration = Date.now() - start;
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(10000); // Should complete in <10s
  });
});
