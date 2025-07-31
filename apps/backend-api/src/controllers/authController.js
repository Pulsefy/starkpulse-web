const authService = require("../services/authService");
const User = require("../models/User");
const {
  generateTokens,
  verifyToken,
  revokeToken,
} = require("../auth/utils/jwt");
const { sendVerificationEmail } = require("../services/email");
const audit = require("../services/audit");

class AuthController {
  // ==========================
  //Register new user
  // ==========================
  async register(req, res) {
    try {
      const userData = req.validatedData;
      const deviceInfo = req.headers["user-agent"] || "Unknown Device";

      const result = await authService.registerUser(userData, deviceInfo);

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        user: result.user,
        tokens: result.tokens,
      });
    } catch (error) {
      console.error("Registration error:", error);

      if (error.message === "User with this email already exists") {
        return res.status(409).json({
          success: false,
          message: "User with this email already exists",
        });
      }

      res.status(500).json({
        success: false,
        message: "Registration failed",
      });
    }
  }

  // ==========================
  //Login user
  // ==========================
  async login(req, res) {
    try {
      const { email, password } = req.validatedData;
      const deviceInfo = req.headers["user-agent"] || "Unknown Device";

      const result = await authService.loginUser(email, password, deviceInfo);

      res.json({
        success: true,
        message: "Login successful",
        user: result.user,
        tokens: result.tokens,
      });
    } catch (error) {
      console.error("Login error:", error);

      if (error.message === "Invalid credentials") {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      if (
        error.message ===
        "Account temporarily locked due to too many failed login attempts"
      ) {
        return res.status(423).json({
          success: false,
          message:
            "Account temporarily locked due to too many failed login attempts",
        });
      }

      if (error.message === "Account is deactivated") {
        return res.status(401).json({
          success: false,
          message: "Account is deactivated",
        });
      }

      res.status(500).json({
        success: false,
        message: "Login failed",
      });
    }
  }

  // ==========================
  //Refresh access token
  // ==========================
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      const deviceInfo = req.headers["user-agent"] || "Unknown Device";

      const tokens = await authService.refreshTokens(refreshToken, deviceInfo);

      res.json({
        success: true,
        message: "Tokens refreshed successfully",
        tokens,
      });
    } catch (error) {
      console.error("Token refresh error:", error);

      if (error.message === "Refresh token required") {
        return res.status(400).json({
          success: false,
          message: "Refresh token required",
        });
      }

      if (error.message.includes("expired")) {
        return res.status(401).json({
          success: false,
          message: "Refresh token expired",
          code: "REFRESH_TOKEN_EXPIRED",
        });
      }

      if (
        error.message === "User not found or inactive" ||
        error.message === "Invalid refresh token"
      ) {
        return res.status(401).json({
          success: false,
          message: "Invalid refresh token",
        });
      }

      res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }
  }

  // ==========================
  //Logout user
  // ==========================
  async logout(req, res) {
    try {
      const refreshToken = req.body.refreshToken;

      await authService.logoutUser(req.user, refreshToken);

      res.json({
        success: true,
        message: "Logout successful",
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Logout failed",
      });
    }
  }

  // ==========================
  //Logout from all devices
  // ==========================
  async logoutAll(req, res) {
    try {
      await authService.logoutAllDevices(req.user);

      res.json({
        success: true,
        message: "Logged out from all devices successfully",
      });
    } catch (error) {
      console.error("Logout all error:", error);
      res.status(500).json({
        success: false,
        message: "Logout from all devices failed",
      });
    }
  }

  // ==========================
  //Forgot password
  // ==========================
  async forgotPassword(req, res) {
    try {
      const { email } = req.validatedData;

      await authService.forgotPassword(email);

      res.json({
        success: true,
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    } catch (error) {
      console.error("Forgot password error:", error);

      if (error.message === "Failed to send reset email") {
        return res.status(500).json({
          success: false,
          message: "Failed to send reset email",
        });
      }

      res.status(500).json({
        success: false,
        message: "Password reset request failed",
      });
    }
  }

  // ==========================
  //Reset password
  // ==========================
  async resetPassword(req, res) {
    try {
      const { token, password } = req.validatedData;

      await authService.resetPassword(token, password);

      res.json({
        success: true,
        message: "Password reset successful",
      });
    } catch (error) {
      console.error("Reset password error:", error);

      if (error.message === "Invalid or expired reset token") {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired reset token",
        });
      }

      res.status(500).json({
        success: false,
        message: "Password reset failed",
      });
    }
  }

  // ==========================
  //Get current user info
  // ==========================
  async getCurrentUser(req, res) {
    try {
      const userInfo = authService.getUserInfo(req.user);

      res.json({
        success: true,
        user: userInfo,
      });
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch user info",
      });
    }
  }

  // ==========================
  //Get active sessions
  // ==========================
  async getSessions(req, res) {
    try {
      const currentRefreshToken = req.body.refreshToken;
      const sessions = await authService.getUserSessions(
        req.user._id,
        currentRefreshToken,
      );

      res.json({
        success: true,
        sessions,
      });
    } catch (error) {
      console.error("Get sessions error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch sessions",
      });
    }
  }

  async verifyEmail(req, res) {
    try {
      const { token } = req.validateData;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Verification token is required",
        });
      }

      const result = await authService.verifyEmail(token);

      res.status(200).json(result);
    } catch (error) {
      console.error("Email verification error:", error);

      if (error.message === "Invalid or expired verification token") {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired verification token",
        });
      }

      res.status(500).json({
        success: false,
        message: "Email verification failed",
      });
    }
  }
}

module.exports = new AuthController();

exports.register = async (req, res) => {
  try {
    const { email, password, walletAddress } = req.body;

    let user;
    if (email) {
      user = new User({
        email,
        password: await bcrypt.hash(password, 10),
        authMethod: "email",
      });
    } else if (walletAddress) {
      user = new User({
        walletAddress,
        authMethod: "wallet",
      });
    }

    await user.save();

    if (email) {
      await sendVerificationEmail(user);
    }

    const tokens = await generateTokens(user);

    audit.log({
      action: "user_registered",
      userId: user.id,
      metadata: { authMethod: user.authMethod },
    });

    res.json({ ...tokens, user: user.toJSON() });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  const tokens = await generateTokens(req.user);

  audit.log({
    action: "user_logged_in",
    userId: req.user.id,
    metadata: { authMethod: req.user.authMethod },
  });

  res.json({ ...tokens, user: req.user.toJSON() });
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const decoded = verifyToken(refreshToken, true);

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const tokens = await generateTokens(user);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({ message: "Invalid refresh token" });
  }
};

exports.logout = async (req, res) => {
  await revokeToken(req.user.id);

  audit.log({
    action: "user_logged_out",
    userId: req.user.id,
  });

  res.json({ message: "Logged out successfully" });
};

exports.authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};
