const { Queue } = require("bullmq");
const {   getRedisClient } = require("../../config/redis");

const emailQueue = new Queue("emailQueue", { connection: getRedisClient });

module.exports = emailQueue;
