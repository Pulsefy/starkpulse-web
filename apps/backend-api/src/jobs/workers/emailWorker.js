const { Worker } = require("bullmq");
const { getRedisClient } = require("../../config/redis");

const emailWorker = new Worker(
  "emailQueue",
  async (job) => {
    console.log("[Email Worker] Processing:", job.name, job.data);
    // TODO: call your EmailService here
  },
  { connection: getRedisClient }
);

emailWorker.on("completed", (job) => {
  console.log(`[Email Worker] Job ${job.id} completed`);
});

emailWorker.on("failed", (job, err) => {
  console.error(`[Email Worker] Job ${job?.id} failed:`, err);
});

module.exports = emailWorker;
