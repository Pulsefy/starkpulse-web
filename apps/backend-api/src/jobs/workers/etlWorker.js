const { Worker } = require("bullmq");
const { getRedisClient } = require("../../config/redis");

const etlWorker = new Worker(
  "etlQueue",
  async (job) => {
    console.log("[ETL Worker] Processing:", job.name, job.data);
    // TODO: call your EtlService here
  },
  { connection: getRedisClient }
);

etlWorker.on("completed", (job) => {
  console.log(`[ETL Worker] Job ${job.id} completed`);
});
etlWorker.on("failed", (job, err) => {
  console.error(`[ETL Worker] Job ${job?.id} failed:`, err);
});

module.exports = etlWorker;
