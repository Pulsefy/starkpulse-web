const cryptoPriceService = require('./cryptoPrice.js');

async function calculatePortfolioMetrics(portfolio) {
  if (!portfolio || !portfolio.assets || portfolio.assets.length === 0) {
    return getEmptyPortfolioMetrics();
  }

  // Get current prices for all assets in parallel
  const symbols = [...new Set(portfolio.assets.map(asset => asset.symbol))];
  const currentPrices = await getCurrentPrices(symbols);

  let totalInvested = 0;
  let currentValue = 0;
  const assetMetrics = [];

  // Calculate metrics for each asset
  for (const asset of portfolio.assets) {
    const currentPrice = currentPrices[asset.symbol]?.price || 0;
    const priceChange24h = currentPrices[asset.symbol]?.change24h || 0;
    const invested = asset.quantity * asset.buyPrice;
    const value = asset.quantity * currentPrice;
    const profitLoss = value - invested;
    const profitLossPercent = invested > 0 ? (profitLoss / invested) * 100 : 0;

    totalInvested += invested;
    currentValue += value;

    assetMetrics.push({
      symbol: asset.symbol,
      name: asset.name,
      quantity: asset.quantity,
      buyPrice: asset.buyPrice,
      currentPrice,
      priceChange24h,
      invested,
      value,
      profitLoss,
      profitLossPercent,
      weight: 0 
    });
  }

  // Calculate weights and diversification
  if (currentValue > 0) {
    assetMetrics.forEach(asset => {
      asset.weight = (asset.value / currentValue) * 100;
    });
  }

  const totalProfitLoss = currentValue - totalInvested;
  const totalProfitLossPercent = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

  // Calculate portfolio risk
  const riskScore = calculateRiskScore(assetMetrics);

  return {
    portfolioId: portfolio._id,
    userId: portfolio.userId,
    totalInvested,
    currentValue,
    totalProfitLoss,
    totalProfitLossPercent,
    riskScore,
    assets: assetMetrics,
    diversification: analyzeDiversification(assetMetrics),
    updatedAt: new Date()
  };
}

async function getCurrentPrices(symbols) {
  const prices = {};
  const pricePromises = symbols.map(async symbol => {
    prices[symbol] = await cryptoPriceService.getPriceWithChange(symbol);
  });
  await Promise.all(pricePromises);
  return prices;
}

function calculateRiskScore(assets) {
  if (assets.length === 0) return 0;
  
  // Calculate weighted volatility based on 24h changes
  const weightedVolatility = assets.reduce((sum, asset) => {
    const volatility = Math.abs(asset.priceChange24h) / 100;
    return sum + (volatility * asset.weight);
  }, 0);
  
  return Math.min(Math.round(weightedVolatility * 100), 100);
}

function analyzeDiversification(assets) {
  const count = assets.length;
  let analysis = 'Highly Concentrated';
  
  if (count >= 10) analysis = 'Well Diversified';
  else if (count >= 5) analysis = 'Moderately Diversified';
  else if (count >= 3) analysis = 'Somewhat Diversified';
  
  return {
    assetCount: count,
    analysis,
    topAssets: assets
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(asset => ({
        symbol: asset.symbol,
        weight: asset.weight.toFixed(2),
        currentPrice: asset.currentPrice
      }))
  };
}

function getEmptyPortfolioMetrics() {
  return {
    totalInvested: 0,
    currentValue: 0,
    totalProfitLoss: 0,
    totalProfitLossPercent: 0,
    riskScore: 0,
    assets: [],
    diversification: {
      assetCount: 0,
      analysis: 'No Assets',
      topAssets: []
    }
  };
}

module.exports = { calculatePortfolioMetrics };