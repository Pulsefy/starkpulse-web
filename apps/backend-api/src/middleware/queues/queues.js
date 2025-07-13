

// call the bull library and create the environment it runs on

const Queues = require("bull");

const queues = new Queues("send_email", {
    redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
    }
});


export default queues;