const express = require("express");
const router = express.Router();
const cacheService = require("../cacheService");

async function fetchMarketPrices() {
  return [
    { symbol: "BTC", price: 27000 },
    { symbol: "ETH", price: 1800 },
  ];
}

router.get("/prices", async (req, res) => {
  const cacheKey = "market-prices";

  const cachedPrices = await cacheService.get(cacheKey);
  if (cachedPrices) return res.json(cachedPrices);

  const prices = await fetchMarketPrices();

  await cacheService.set(cacheKey, prices, 60);
  res.json(prices);
});

module.exports = router;
