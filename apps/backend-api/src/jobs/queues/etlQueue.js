const { Queue } = require("bullmq");
const {   getRedisClient } = require("../../config/redis");

const etlQueue = new Queue("etlQueue", { connection: getRedisClient });

module.exports = etlQueue;
