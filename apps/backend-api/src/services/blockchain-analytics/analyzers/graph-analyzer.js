const logger = require('../../../utils/logger');

class GraphAnalyzer {
  constructor(config) {
    this.config = config;
    this.graph = new Map(); // Adjacency list representation
  }

  async analyzeAddress(address, options = {}) {
    try {
      const depth = options.depth || 2;
      const minValue = options.minValue || 1; // ETH
      
      // Build transaction graph
      const graph = await this.buildTransactionGraph(address, depth, minValue);
      
      // Analyze graph properties
      const analysis = {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        centrality: this.calculateCentrality(graph, address),
        clustering: this.calculateClusteringCoefficient(graph, address),
        communities: await this.detectCommunities(graph),
        pathAnalysis: this.analyzeShortestPaths(graph, address),
        riskPropagation: this.analyzeRiskPropagation(graph, address)
      };
      
      return analysis;
    } catch (error) {
      logger.error('Error in graph analysis:', error);
      return { error: error.message };
    }
  }

  async buildTransactionGraph(rootAddress, depth, minValue) {
    const nodes = new Set();
    const edges = [];
    const visited = new Set();
    const queue = [{ address: rootAddress, currentDepth: 0 }];
    
    while (queue.length > 0) {
      const { address, currentDepth } = queue.shift();
      
      if (visited.has(address) || currentDepth >= depth) continue;
      visited.add(address);
      nodes.add(address);
      
      // Get transactions for this address
      const transactions = await this.getTransactionsForAddress(address);
      
      for (const tx of transactions) {
        if (tx.value < minValue) continue;
        
        const counterparty = tx.from === address ? tx.to : tx.from;
        
        if (counterparty && !visited.has(counterparty)) {
          queue.push({ address: counterparty, currentDepth: currentDepth + 1 });
        }
        
        edges.push({
          from: tx.from,
          to: tx.to,
          value: tx.value,
          timestamp: tx.timestamp,
          hash: tx.hash
        });
        
        nodes.add(tx.from);
        nodes.add(tx.to);
      }
    }
    
    return {
      nodes: Array.from(nodes),
      edges,
      rootAddress
    };
  }

  calculateCentrality(graph, address) {
    // Calculate different centrality measures
    return {
      degree: this.calculateDegreeCentrality(graph, address),
      betweenness: this.calculateBetweennessCentrality(graph, address),
      closeness: this.calculateClosenessCentrality(graph, address),
      eigenvector: this.calculateEigenvectorCentrality(graph, address)
    };
  }

  calculateDegreeCentrality(graph, address) {
    const connections = graph.edges.filter(edge => 
      edge.from === address || edge.to === address
    );
    
    return {
      inDegree: connections.filter(edge => edge.to === address).length,
      outDegree: connections.filter(edge => edge.from === address).length,
      totalDegree: connections.length
    };
  }

  calculateClusteringCoefficient(graph, address) {
    // Find neighbors of the address
    const neighbors = new Set();
    graph.edges.forEach(edge => {
      if (edge.from === address) neighbors.add(edge.to);
      if (edge.to === address) neighbors.add(edge.from);
    });
    
    if (neighbors.size < 2) return 0;
    
    // Count edges between neighbors
    let edgesBetweenNeighbors = 0;
    const neighborArray = Array.from(neighbors);
    
    for (let i = 0; i < neighborArray.length; i++) {
      for (let j = i + 1; j < neighborArray.length; j++) {
        const hasEdge = graph.edges.some(edge =>
          (edge.from === neighborArray[i] && edge.to === neighborArray[j]) ||
          (edge.from === neighborArray[j] && edge.to === neighborArray[i])
        );
        
        if (hasEdge) edgesBetweenNeighbors++;
      }
    }
    
    const possibleEdges = (neighbors.size * (neighbors.size - 1)) / 2;
    return edgesBetweenNeighbors / possibleEdges;
  }

  async detectCommunities(graph) {
    // Implement community detection algorithm (simplified Louvain)
    const communities = new Map();
    let communityId = 0;
    
    // Initialize each node in its own community
    graph.nodes.forEach(node => {
      communities.set(node, communityId++);
    });
    
    // Iteratively optimize modularity
    let improved = true;
    let iterations = 0;
    const maxIterations = 10;
    
    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;
      
      for (const node of graph.nodes) {
        const currentCommunity = communities.get(node);
        const neighborCommunities = this.getNeighborCommunities(graph, node, communities);
        
        let bestCommunity = currentCommunity;
        let bestModularityGain = 0;
        
        for (const [community, gain] of neighborCommunities) {
          if (gain > bestModularityGain) {
            bestModularityGain = gain;
            bestCommunity = community;
          }
        }
        
        if (bestCommunity !== currentCommunity) {
          communities.set(node, bestCommunity);
          improved = true;
        }
      }
    }
    
    // Group nodes by community
    const communityGroups = new Map();
    communities.forEach((community, node) => {
      if (!communityGroups.has(community)) {
        communityGroups.set(community, []);
      }
      communityGroups.get(community).push(node);
    });
    
    return Array.from(communityGroups.values());
  }

  analyzeRiskPropagation(graph, address) {
    // Analyze how risk might propagate through the network
    const riskScores = new Map();
    const visited = new Set();
    
    // Initialize risk scores
    graph.nodes.forEach(node => {
      riskScores.set(node, node === address ? 1.0 : 0.0);
    });
    
    // Propagate risk through the network
    const queue = [address];
    visited.add(address);
    
    while (queue.length > 0) {
      const currentNode = queue.shift();
      const currentRisk = riskScores.get(currentNode);
      
      // Find connected nodes
      const connections = graph.edges.filter(edge =>
        edge.from === currentNode || edge.to === currentNode
      );
      
      for (const edge of connections) {
        const neighbor = edge.from === currentNode ? edge.to : edge.from;
        
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
          
          // Risk decreases with distance and transaction value
          const riskTransfer = currentRisk * 0.5 * Math.min(edge.value / 100, 1);
          const existingRisk = riskScores.get(neighbor) || 0;
          riskScores.set(neighbor, Math.max(existingRisk, riskTransfer));
        }
      }
    }
    
    // Return top risky addresses
    const sortedRisks = Array.from(riskScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    
    return {
      propagationDepth: visited.size,
      riskDistribution: sortedRisks,
      averageRisk: Array.from(riskScores.values()).reduce((a, b) => a + b, 0) / riskScores.size
    };
  }

  // Helper methods
  async getTransactionsForAddress(address) {
    // This would connect to your blockchain data source
    // Return mock data for now
    return [];
  }

  getNeighborCommunities(graph, node, communities) {
    const neighborCommunities = new Map();
    
    graph.edges.forEach(edge => {
      let neighbor = null;
      if (edge.from === node) neighbor = edge.to;
      if (edge.to === node) neighbor = edge.from;
      
      if (neighbor) {
        const community = communities.get(neighbor);
        neighborCommunities.set(community, (neighborCommunities.get(community) || 0) + 1);
      }
    });
    
    return neighborCommunities;
  }
}

module.exports = GraphAnalyzer;