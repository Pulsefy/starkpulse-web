const crypto = require("crypto");
const User = require("../models/User");
const emailService = require("../services/emailService");
const jwtService = require("../config/jwt");

class AuthService {
  // ==========================
  //Register a new user
  // ==========================
 async registerUser(userData, deviceInfo) {
  const { firstName, lastName, email, password } = userData;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("User with this email already exists");
  }

  const user = new User({
    firstName,
    lastName,
    email,
    password,
    emailVerified: false,
  });

  const verificationToken = user.createEmailVerificationToken();
  await user.save();

  try {
    await emailService.sendEmailVerificationEmail(
      user.email,
      user.firstName,
      verificationToken
    );
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError);
    throw new Error("Failed to send verification email");
  }

  const tokenPayload = {
    userId: user._id,
    email: user.email,
    emailVerified: false, 
  };

  const tokens = jwtService.generateTokenPair(tokenPayload);

  const refreshTokenExpiry = new Date();
  refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

  await user.addRefreshToken(
    jwtService.hashToken(tokens.refreshToken),
    refreshTokenExpiry,
    deviceInfo
  );

  return {
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      emailVerified: user.emailVerified,
      preferences: user.preferences,
      privacy: user.privacy,
    },
    tokens,
  };
}

  // ==========================
  //Login user
  // ==========================
  async loginUser(email, password, deviceInfo) {
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      throw new Error("Invalid credentials");
    }

    if (user.isLocked) {
      throw new Error(
        "Account temporarily locked due to too many failed login attempts"
      );
    }

    if (!user.isActive) {
      throw new Error("Account is deactivated");
    }

    const isValidPassword = await user.comparePassword(password);

    if (!isValidPassword) {
      await user.incLoginAttempts();
      throw new Error("Invalid credentials");
    }

    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    await user.cleanExpiredRefreshTokens();

    const tokenPayload = {
      userId: user._id,
      email: user.email,
    };

    const tokens = jwtService.generateTokenPair(tokenPayload);

    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

    await user.addRefreshToken(
      jwtService.hashToken(tokens.refreshToken),
      refreshTokenExpiry,
      deviceInfo
    );

    user.lastLogin = new Date();
    await user.save();

    return {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        preferences: user.preferences,
        privacy: user.privacy,
        lastLogin: user.lastLogin,
        emailVerified: user.emailVerified,
      },
      tokens,
    };
  }

  // ==========================
  //Refresh access token
  // User  Routes
  // ==========================
  async refreshTokens(refreshToken, deviceInfo) {
    if (!refreshToken) {
      throw new Error("Refresh token required");
    }

    const decoded = jwtService.verifyRefreshToken(refreshToken);
    const hashedToken = jwtService.hashToken(refreshToken);

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      throw new Error("User not found or inactive");
    }

    if (!user.hasValidRefreshToken(hashedToken)) {
      throw new Error("Invalid refresh token");
    }

    const tokenPayload = {
      userId: user._id,
      email: user.email,
    };

    const tokens = jwtService.generateTokenPair(tokenPayload);

    await user.removeRefreshToken(hashedToken);

    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

    await user.addRefreshToken(
      jwtService.hashToken(tokens.refreshToken),
      refreshTokenExpiry,
      deviceInfo
    );

    return tokens;
  }

  // ==========================
  //Logout user (remove refresh token)
  // User  Routes
  // ==========================
  async logoutUser(user, refreshToken) {
    if (refreshToken) {
      const hashedToken = jwtService.hashToken(refreshToken);
      await user.removeRefreshToken(hashedToken);
    }
    return true;
  }

  // ==========================
  //Logout from all devices
  // ==========================
  async logoutAllDevices(user) {
    await user.removeAllRefreshTokens();
    return true;
  }

  // ==========================
  //Initiate password reset process
  // ==========================
  async forgotPassword(email) {
    const user = await User.findOne({ email });

    if (!user) {
      return true;
    }

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    try {
      await emailService.sendPasswordResetEmail(
        user.email,
        user.firstName,
        resetToken
      );
      return true;
    } catch (emailError) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      throw new Error("Failed to send reset email");
    }
  }

  // ==========================
  //Reset password using token
  // ==========================
  async resetPassword(token, newPassword) {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new Error("Invalid or expired reset token");
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;

    await user.removeAllRefreshTokens();

    await user.save();
    return true;
  }

  // ==========================
  //Get user sessions
  // ==========================
  async getUserSessions(userId, currentRefreshToken) {
    const user = await User.findById(userId);
    await user.cleanExpiredRefreshTokens();

    const currentTokenHash = currentRefreshToken
      ? jwtService.hashToken(currentRefreshToken)
      : null;

    const sessions = user.refreshTokens.map((rt) => ({
      deviceInfo: rt.deviceInfo,
      createdAt: rt.createdAt,
      expiresAt: rt.expiresAt,
      isCurrent: currentTokenHash === rt.token,
    }));

    return sessions;
  }

  // ==========================
  //Get current user info
  // ==========================
  getUserInfo(user) {
    return {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      preferences: user.preferences,
      privacy: user.privacy,
      lastLogin: user.lastLogin,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  async verifyEmail(verificationToken) {
  const hashedToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new Error("Invalid or expired verification token");
  }

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  return {
    success: true,
    message: "Email verified successfully",
  };
}
}

module.exports = new AuthService();
