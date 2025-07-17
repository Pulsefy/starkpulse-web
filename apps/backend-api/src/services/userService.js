const User = require("../models/User");
// const emailService = require("./emailService");
const { queue } = require("../middleware/queues/queues");

export const APP_NAME = "StarkPlus";

class UserService {
  // ==========================
  //Get user profile by ID
  // ==========================
  async getUserProfile(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    return {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      preferences: user.preferences,
      privacy: user.privacy,
      emailVerified: user.emailVerified,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  // ==========================
  //Update user profile
  // ==========================
  async updateUserProfile(userId, updates) {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new Error("User not found");
    }

    return {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      preferences: user.preferences,
      privacy: user.privacy,
      updatedAt: user.updatedAt,
    };
  }

  // ==========================
  //Change user password
  // ==========================
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select("+password");

    if (!user) {
      throw new Error("User not found");
    }

    const isValidPassword = await user.comparePassword(currentPassword);
    if (!isValidPassword) {
      throw new Error("Current password is incorrect");
    }

    user.password = newPassword;
    await user.removeAllRefreshTokens();
    await user.save();

    return true;
  }

  // ==========================
  //Delete user account permanently
  // ==========================
  async deleteAccount(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    const userInfo = {
      email: user.email,
      firstName: user.firstName,
    };

    await User.findByIdAndDelete(userId);

    // create the job here
    const emailJob = {
      templateName: 'delete_account.html',
      userEmail: user.email,
      firstName: user.firstName,
      appName: APP_NAME,
      year: new Date().getFullYear().toString(),
      subject: "Account Delected ",
    };


    // call the add method to push it to the queue so it can be processed
    await queue.add("send_email", emailJob);

    return true;
  }

  // ==========================
  //Export user data for GDPR compliance
  // ==========================
  async exportUserData(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    return {
      personalInformation: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        emailVerified: user.emailVerified,
      },
      preferences: user.preferences,
      privacy: user.privacy,
      accountInformation: {
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin,
        isActive: user.isActive,
      },
    };
  }

  // ==========================
  //Deactivate user account (soft delete)
  // ==========================
  async deactivateAccount(userId) {
    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      throw new Error("User not found");
    }

    await user.removeAllRefreshTokens();
    return true;
  }
}

module.exports = new UserService();
