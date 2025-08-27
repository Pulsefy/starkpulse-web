const emailQueue = require("../queues/emailQueue");

(async () => {
  await emailQueue.add(
    "sendDailyDigest",
    { timestamp: Date.now() },
    { repeat: { cron: "0 9 * * *" } } // every day at 9 AM
  );

  await emailQueue.add(
    "weeklyReport",
    { timestamp: Date.now() },
    { repeat: { cron: "0 8 * * MON" } } // every Monday at 8 AM
  );

  console.log("✅ Email scheduler registered");
})();
