// src/analytics/graph.js
// Graph Theory Utilities for Blockchain Analytics

/**
 * Build a transaction graph from a list of transactions.
 * Nodes: unique addresses/contracts
 * Edges: transactions (from, to, value, hash)
 */
function buildTransactionGraph(transactions) {
  const nodes = new Set();
  const edges = [];
  transactions.forEach(tx => {
    if (tx.from_address) nodes.add(tx.from_address);
    if (tx.to_address) nodes.add(tx.to_address);
    edges.push({
      from: tx.from_address,
      to: tx.to_address,
      value: tx.value || null,
      hash: tx.hash,
      type: tx.type
    });
  });
  return {
    nodes: Array.from(nodes).map(addr => ({ id: addr })),
    edges
  };
}

/**
 * Cluster nodes in a graph using simple heuristics (e.g., shared transaction partners).
 */
function clusterGraphNodes(graph) {
  // Simple clustering: group nodes by degree (number of connections)
  const clusters = [];
  const nodeDegree = {};
  graph.edges.forEach(edge => {
    nodeDegree[edge.from] = (nodeDegree[edge.from] || 0) + 1;
    nodeDegree[edge.to] = (nodeDegree[edge.to] || 0) + 1;
  });
  // Group nodes by high/low degree
  const highDegree = [], lowDegree = [];
  graph.nodes.forEach(node => {
    if ((nodeDegree[node.id] || 0) > 5) highDegree.push(node.id);
    else lowDegree.push(node.id);
  });
  if (highDegree.length) clusters.push({ label: 'high_degree', members: highDegree });
  if (lowDegree.length) clusters.push({ label: 'low_degree', members: lowDegree });
  return { clusters };
}

module.exports = {
  buildTransactionGraph,
  clusterGraphNodes
};
