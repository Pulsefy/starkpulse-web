const { Queue } = require("bullmq");
const {   getRedisClient } = require("../../config/redis");

const reportQueue = new Queue("reportQueue", { connection: getRedisClient });

module.exports = reportQueue;
