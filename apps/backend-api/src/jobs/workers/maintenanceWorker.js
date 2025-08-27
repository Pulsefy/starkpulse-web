const { Worker } = require("bullmq");
const { getRedisClient } = require("../../config/redis");

const maintenanceWorker = new Worker(
  "maintenanceQueue",
  async (job) => {
    console.log("[Maintenance Worker] Processing:", job.name, job.data);
    // TODO: call your MaintenanceService here
  },
  { connection: getRedisClient }
);

maintenanceWorker.on("completed", (job) => {
  console.log(`[Maintenance Worker] Job ${job.id} completed`);
});
maintenanceWorker.on("failed", (job, err) => {
  console.error(`[Maintenance Worker] Job ${job?.id} failed:`, err);
});

module.exports = maintenanceWorker;
