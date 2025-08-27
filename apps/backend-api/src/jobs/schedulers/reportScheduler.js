const reportQueue = require("../queues/reportQueue");

(async () => {
  await reportQueue.add(
    "generateDailyReport",
    { timestamp: Date.now() },
    { repeat: { cron: "0 6 * * *" } } // every day at 6 AM
  );

  await reportQueue.add(
    "monthlySummaryReport",
    { timestamp: Date.now() },
    { repeat: { cron: "0 7 1 * *" } } // every 1st of the month at 7 AM
  );

  console.log("✅ Report scheduler registered");
})();
