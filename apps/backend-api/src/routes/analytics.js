// src/routes/analytics.js
const express = require('express');
const router = express.Router();
const onchain = require('../analytics/onchain');
const defi = require('../analytics/defi');
const market = require('../analytics/market');

// Example: GET /analytics/onchain/transaction-flow?address=0x...
router.get('/onchain/transaction-flow', async (req, res) => {
  const { address } = req.query;
  const result = await onchain.analyzeTransactionFlow([address], null);
  res.json(result);
});

router.get('/onchain/cluster-addresses', async (req, res) => {
  const { address } = req.query;
  const result = await onchain.clusterAddresses([address], null);
  res.json(result);
});

router.get('/onchain/contract-interactions', async (req, res) => {
  const { address } = req.query;
  const result = await onchain.analyzeContractInteractions(address, null);
  res.json(result);
});

router.get('/onchain/mev', async (req, res) => {
  const { address } = req.query;
  const result = await onchain.detectMEV([address], null);
  res.json(result);
});

// DeFi Intelligence
router.get('/defi/liquidity-pools', async (req, res) => {
  const { protocol } = req.query;
  const result = await defi.analyzeLiquidityPools(protocol, null);
  res.json(result);
});

router.get('/defi/yield-farming', async (req, res) => {
  const { protocol } = req.query;
  const result = await defi.identifyYieldFarming(protocol, null);
  res.json(result);
});

router.get('/defi/protocol-risk', async (req, res) => {
  const { protocol } = req.query;
  const result = await defi.assessProtocolRisk(protocol, null);
  res.json(result);
});

router.get('/defi/governance', async (req, res) => {
  const { protocol } = req.query;
  const result = await defi.analyzeGovernanceTokens(protocol, null);
  res.json(result);
});

// Market Intelligence
router.get('/market/whale-movements', async (req, res) => {
  const result = await market.trackWhaleMovements(null);
  res.json(result);
});

router.get('/market/institutional-flows', async (req, res) => {
  const result = await market.analyzeInstitutionalFlows(null);
  res.json(result);
});

router.get('/market/manipulation', async (req, res) => {
  const result = await market.detectMarketManipulation(null);
  res.json(result);
});

router.get('/market/bridges', async (req, res) => {
  const result = await market.monitorCrossChainBridges(null);
  res.json(result);
});

module.exports = router;
