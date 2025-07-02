// Security middleware: helmet, mongo-sanitize, xss-clean, CSP
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

module.exports = [
  helmet(),
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://trusted.cdn.com'], // Adjust as needed
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  }),
  mongoSanitize(),
  xss(),
]; 