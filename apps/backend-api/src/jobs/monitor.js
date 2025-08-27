const { Queue, QueueEvents } = require("bullmq");
const { getRedisClient } = require("../config/redis");
const { createBullBoard } = require("@bull-board/api");
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");
const { ExpressAdapter } = require("@bull-board/express");

const queues = ["emailQueue", "etlQueue", "reportQueue", "maintenanceQueue"];

queues.forEach((queueName) => {
  const queue = new Queue(queueName, { connection: getRedisClient });

  const events = new QueueEvents(queueName, { connection: getRedisClient });
  events.on("completed", ({ jobId }) => {
    console.log(`✅ [${queueName}] Job ${jobId} completed`);
  });
  events.on("failed", ({ jobId, failedReason }) => {
    console.error(`❌ [${queueName}] Job ${jobId} failed: ${failedReason}`);
  });

  console.log(`📡 Monitoring started for queue: ${queueName}`);
});




const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath("/admin/queues");

const emailQueue = new Queue("emailQueue", { connection: getRedisClient });
const etlQueue = new Queue("etlQueue", { connection: getRedisClient });
const reportQueue = new Queue("reportQueue", { connection: getRedisClient });
const maintenanceQueue = new Queue("maintenanceQueue", { connection: getRedisClient });

createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue),
    new BullMQAdapter(etlQueue),
    new BullMQAdapter(reportQueue),
    new BullMQAdapter(maintenanceQueue),
  ],
  serverAdapter: serverAdapter,
});



module.exports = serverAdapter;
