// src/controllers/monitorController.js
const { Queue } = require("bullmq");
const { getRedisClient } = require("../config/redis");

const queues = {
  email: new Queue("emailQueue", { connection: getRedisClient }),
  etl: new Queue("etlQueue", { connection: getRedisClient }),
  report: new Queue("reportQueue", { connection: getRedisClient }),
  maintenance: new Queue("maintenanceQueue", { connection: getRedisClient }),
};

exports.getQueueStats = async (req, res) => {
  try {
    const stats = {};
    for (const [name, queue] of Object.entries(queues)) {
      stats[name] = {
        waiting: await queue.getWaitingCount(),
        active: await queue.getActiveCount(),
        completed: await queue.getCompletedCount(),
        failed: await queue.getFailedCount(),
        delayed: await queue.getDelayedCount(),
      };
    }
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching queue stats");
  }
};
