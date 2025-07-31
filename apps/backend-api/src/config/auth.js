module.exports = {
  accessTokenSecret:
    process.env.ACCESS_TOKEN_SECRET || "your_access_token_secret",
  refreshTokenSecret:
    process.env.REFRESH_TOKEN_SECRET || "your_refresh_token_secret",
  accessTokenExpiry: "15m",
  refreshTokenExpiry: "7d",
  refreshTokenExpirySeconds: 7 * 24 * 60 * 60,
  starknetNetwork: process.env.STARKNET_NETWORK || "goerli",
  mfa: {
    totp: {
      issuer: "StarkPulse",
      digits: 6,
      period: 30,
    },
  },
};
