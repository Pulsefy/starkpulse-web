const { Worker } = require("bullmq");
const { getRedisClient } = require("../../config/redis");

const reportWorker = new Worker(
  "reportQueue",
  async (job) => {
    console.log("[Report Worker] Processing:", job.name, job.data);
    // TODO: call your MaintenanceService here
  },
  { connection: getRedisClient }
);

reportWorker.on("completed", (job) => {
  console.log(`[Report Worker] Job ${job.id} completed`);
});
reportWorker.on("failed", (job, err) => {
  console.error(`[Report Worker] Job ${job?.id} failed:`, err);
});

module.exports = reportWorker;
