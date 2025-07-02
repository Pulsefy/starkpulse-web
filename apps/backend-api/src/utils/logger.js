// Logging utilities

const pino = require('pino');

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      translateTime: true,
      colorize: true,
    },
  },
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});

module.exports = logger;
