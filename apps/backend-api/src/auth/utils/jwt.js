const jwt = require("jsonwebtoken");
const config = require("../../config/auth");
const redisClient = require("../../redisClient");

const generateTokens = async (user) => {
  const accessToken = jwt.sign(
    { userId: user.id, role: user.role },
    config.accessTokenSecret,
    { expiresIn: config.accessTokenExpiry },
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    config.refreshTokenSecret,
    { expiresIn: config.refreshTokenExpiry },
  );

  // Store refresh token in Redis
  await redisClient.set(
    `refreshToken:${user.id}`,
    refreshToken,
    "EX",
    config.refreshTokenExpirySeconds,
  );

  return { accessToken, refreshToken };
};

const verifyToken = (token, isRefresh = false) => {
  const secret = isRefresh
    ? config.refreshTokenSecret
    : config.accessTokenSecret;
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};

const revokeToken = async (userId) => {
  await redisClient.del(`refreshToken:${userId}`);
};

module.exports = { generateTokens, verifyToken, revokeToken };
