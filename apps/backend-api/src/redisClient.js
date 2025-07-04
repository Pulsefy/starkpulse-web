const redis = require("redis");

const redisClient = redis.createClient({
  url: "redis://localhost:6379", // adjust Redis URL here
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error", err);
});

(async () => {
  await redisClient.connect();
})();

module.exports = redisClient;
