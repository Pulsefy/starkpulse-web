// CORS configuration middleware
const cors = require('cors');

const allowedOrigins = [
  'http://localhost:3000', // Update with your frontend URL
  'https://your-frontend-domain.com'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

module.exports = cors(corsOptions);
