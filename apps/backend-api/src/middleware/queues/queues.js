

// call the bull library and create the environment it runs on

const Queue = require("bull");

export const queue = new Queue("send_email", {
    redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
    }
});

module.exports = queue;