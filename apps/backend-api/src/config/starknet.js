// src/config/starknet.js
require('dotenv').config();

module.exports = {
  STARKSCAN_API_URL: process.env.STARKSCAN_API_URL || 'https://starkscan.stellate.sh',
  STARKSCAN_API_KEY: process.env.STARKSCAN_API_KEY || '', // Add your API key here when available
  VOYAGER_API_URL: process.env.VOYAGER_API_URL || 'https://api.voyager.online',
};
