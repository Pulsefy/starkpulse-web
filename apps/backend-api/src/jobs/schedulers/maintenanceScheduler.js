const maintenanceQueue = require("../queues/maintenanceQueue");

(async () => {
  await maintenanceQueue.add(
    "cleanupOldLogs",
    {},
    { repeat: { cron: "0 3 * * *" } } // every day at 3 AM
  );

  await maintenanceQueue.add(
    "archiveOldRecords",
    {},
    { repeat: { cron: "0 5 * * SAT" } } // every Saturday at 5 AM
  );

  console.log("✅ Maintenance scheduler registered");
})();
