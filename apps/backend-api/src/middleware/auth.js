const User = require("../models/User");
const jwtService = require("../config/index");

// ==========================
// Middleware to check if user is authenticated
// ==========================
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }

    const token = jwtService.jwt.extractTokenFromHeader(authHeader);
    const decoded = jwtService.jwt.verifyAccessToken(token);

    // ==========================
    // Find user and check if still active
    // ==========================
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User not found or inactive",
      });
    }
    if (!req.user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email address to access this resource",
      });
    }
    // ==========================
    // Check if token was issued before password change
    // ==========================
    if (
      user.passwordChangedAt &&
      decoded.iat < user.passwordChangedAt.getTime() / 1000
    ) {
      return res.status(401).json({
        success: false,
        message: "Token invalid due to password change",
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    if (error.message.includes("expired")) {
      return res.status(401).json({
        success: false,
        message: "Access token expired",
        code: "TOKEN_EXPIRED",
      });
    }

    res.status(401).json({
      success: false,
      message: "Invalid access token",
    });
  }
};

// ==========================
// Middleware to check if user is already authenticated
// ==========================
const requireGuest = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    try {
      const token = jwtService.jwt.extractTokenFromHeader(authHeader);
      jwtService.jwt.verifyAccessToken(token);

      return res.status(400).json({
        success: false,
        message: "Already authenticated",
      });
    } catch (error) {}
  }

  next();
};

// ==========================
// Middleware to check if user owns the resource
// ==========================
const requireOwnership = (req, res, next) => {
  if (req.params.userId && req.params.userId !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }
  next();
};

module.exports = {
  requireAuth,
  requireGuest,
  requireOwnership,
};
