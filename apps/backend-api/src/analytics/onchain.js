// src/analytics/onchain.js
// On-Chain Analysis Engine
const axios = require('axios');
const graphUtils = require('./graph');
const starknetConfig = require('../config/starknet');

/**
 * Fetch transactions for a StarkNet address using StarkScan API (public endpoints if no key).
 * Returns an array of transactions (up to 1000 most recent).
 */
async function fetchStarknetTransactions(address, limit = 1000) {
  const url = `${starknetConfig.STARKSCAN_API_URL}/api/v0/accounts/${address}/transactions?limit=${limit}`;
  const headers = {};
  if (starknetConfig.STARKSCAN_API_KEY) {
    headers['Authorization'] = `Bearer ${starknetConfig.STARKSCAN_API_KEY}`;
  }
  try {
    const response = await axios.get(url, { headers });
    return response.data?.transactions || [];
  } catch (err) {
    return [];
  }
}

/**
 * Analyze transaction flows for a given address or set of addresses.
 * Returns a graph structure of flows.
 */
async function analyzeTransactionFlow(addresses, provider) {
  // For now, only support single address (expandable)
  const address = addresses[0];
  const txs = await fetchStarknetTransactions(address, 1000);
  // Build graph: nodes (addresses/contracts), edges (txs)
  const graph = graphUtils.buildTransactionGraph(txs);
  // Cluster addresses/entities
  const clusters = graphUtils.clusterGraphNodes(graph);
  // Map contract interactions
  const contractInteractions = txs.filter(tx => tx.type === 'INVOKE' || tx.type === 'DEPLOY');
  return {
    nodes: graph.nodes,
    edges: graph.edges,
    clusters: clusters.clusters,
    contractInteractions,
    summary: `Analyzed ${txs.length} transactions for address ${address}.`
  };
}

/**
 * Cluster addresses/entities based on transaction patterns.
 */
async function clusterAddresses(addresses, provider) {
  // Use transaction graph clustering
  const address = addresses[0];
  const txs = await fetchStarknetTransactions(address, 1000);
  const graph = graphUtils.buildTransactionGraph(txs);
  const clusters = graphUtils.clusterGraphNodes(graph);
  return {
    clusters: clusters.clusters,
    summary: `Clustered addresses for ${address}.`
  };
}

/**
 * Analyze smart contract interactions for a given address or contract.
 */
async function analyzeContractInteractions(addressOrContract, provider) {
  const txs = await fetchStarknetTransactions(addressOrContract, 1000);
  const contractTxs = txs.filter(tx => tx.type === 'INVOKE' || tx.type === 'DEPLOY');
  return {
    interactions: contractTxs,
    summary: `Found ${contractTxs.length} contract interactions for ${addressOrContract}.`
  };
}

/**
 * Detect MEV (Maximum Extractable Value) opportunities or events.
 */
async function detectMEV(addresses, provider) {
  // Placeholder: Analyze tx ordering, sandwich attacks, etc.
  return {
    mevEvents: [],
    summary: 'MEV detection not yet implemented.'
  };
}

module.exports = {
  analyzeTransactionFlow,
  clusterAddresses,
  analyzeContractInteractions,
  detectMEV
};
