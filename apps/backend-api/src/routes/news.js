const express = require("express");
const router = express.Router();
const cacheService = require("../cacheService");

async function fetchNews() {
  return [{ id: 1, title: "Breaking News!", content: "Some news content..." }];
}

router.get("/", async (req, res) => {
  const cacheKey = "news-latest";

  const cachedNews = await cacheService.get(cacheKey);
  if (cachedNews) return res.json(cachedNews);

  const news = await fetchNews();

  await cacheService.set(cacheKey, news, 300);
  res.json(news);
});

module.exports = router;
