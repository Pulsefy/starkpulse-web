const jwt = require("jsonwebtoken");
const crypto = require("crypto");

class JWTService {
  // ==========================
  // Generate access token
  // ==========================
  generateAccessToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "24h",
      issuer: "user-management-api",
      audience: "user-management-client",
    });
  }

  // ==========================
  // Generate refresh token
  // ==========================
  generateRefreshToken(payload) {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
      issuer: "user-management-api",
      audience: "user-management-client",
    });
  }

  // ==========================
  // Verify access token
  // ==========================
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET, {
        issuer: "user-management-api",
        audience: "user-management-client",
      });
    } catch (error) {
      throw new Error("Invalid or expired access token");
    }
  }

  // ==========================
  // Verify refresh token
  // ==========================
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
        issuer: "user-management-api",
        audience: "user-management-client",
      });
    } catch (error) {
      throw new Error("Invalid or expired refresh token");
    }
  }

  // ==========================
  // Generate token pair
  // ==========================
  generateTokenPair(payload) {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    };
  }

  // ==========================
  // Extract token from Authorization header
  // ==========================
  extractTokenFromHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Invalid authorization header format");
    }
    return authHeader.substring(7);
  }

  // ==========================
  // Generate secure random token for password reset
  // ==========================
  generateSecureToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  // ==========================
  // Hash token for storage
  // ==========================
  hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  // ==========================
  // Get token expiration date
  // ==========================
  getTokenExpiration(token) {
    try {
      const decoded = jwt.decode(token);
      return new Date(decoded.exp * 1000);
    } catch (error) {
      return null;
    }
  }
}

module.exports = new JWTService();
