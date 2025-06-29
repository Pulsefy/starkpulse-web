const authService = require("../services/authService");

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
        currentRefreshToken
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
