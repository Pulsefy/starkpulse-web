const { Queue } = require("bullmq");
const {   getRedisClient } = require("../../config/redis");

const maintenanceQueue = new Queue("maintenanceQueue", { connection: getRedisClient });

module.exports = maintenanceQueue;
