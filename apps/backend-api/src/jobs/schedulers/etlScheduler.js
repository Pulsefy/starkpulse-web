const etlQueue = require("../queues/etlQueue");

(async () => {
  await etlQueue.add(
    "dailyETL",
    { timestamp: Date.now() },
    { repeat: { cron: "0 2 * * *" } } // every day at 2 AM
  );

  await etlQueue.add(
    "weeklyDataSync",
    { timestamp: Date.now() },
    { repeat: { cron: "0 4 * * SUN" } } // every Sunday at 4 AM
  );

  console.log("✅ ETL scheduler registered");
})();
