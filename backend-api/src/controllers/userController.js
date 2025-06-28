const userService = require("../services/userService");

class UserController {
  // ==========================
  //Get user profile
  // ==========================
  async getProfile(req, res) {
    try {
      const user = await userService.getUserProfile(req.user._id);

      res.json({
        success: true,
        user,
      });
    } catch (error) {
      console.error("Get profile error:", error);

      if (error.message === "User not found") {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to fetch profile",
      });
    }
  }

  // ==========================
  //Update user profile
  // ==========================
  async updateProfile(req, res) {
    try {
      const updates = req.validatedData;
      const user = await userService.updateUserProfile(req.user._id, updates);

      res.json({
        success: true,
        message: "Profile updated successfully",
        user,
      });
    } catch (error) {
      console.error("Update profile error:", error);

      if (error.message === "User not found") {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to update profile",
      });
    }
  }

  // ==========================
  //Change password
  // ==========================
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.validatedData;

      await userService.changePassword(
        req.user._id,
        currentPassword,
        newPassword
      );

      res.json({
        success: true,
        message:
          "Password changed successfully. Please log in again on all devices.",
      });
    } catch (error) {
      console.error("Change password error:", error);

      if (error.message === "User not found") {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (error.message === "Current password is incorrect") {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to change password",
      });
    }
  }

  // ==========================
  //Delete user account
  // ==========================
  async deleteAccount(req, res) {
    try {
      await userService.deleteAccount(req.user._id);

      res.json({
        success: true,
        message: "Account deleted successfully",
      });
    } catch (error) {
      console.error("Delete account error:", error);

      if (error.message === "User not found") {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to delete account",
      });
    }
  }

  // ==========================
  //Export user data
  // ==========================
  async exportData(req, res) {
    try {
      const userData = await userService.exportUserData(req.user._id);

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="user-data-${req.user._id}.json"`
      );

      res.json({
        success: true,
        exportDate: new Date().toISOString(),
        userData,
      });
    } catch (error) {
      console.error("Export data error:", error);

      if (error.message === "User not found") {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to export user data",
      });
    }
  }

  // ==========================
  //Deactivate account
  // ==========================
  async deactivateAccount(req, res) {
    try {
      await userService.deactivateAccount(req.user._id);

      res.json({
        success: true,
        message: "Account deactivated successfully",
      });
    } catch (error) {
      console.error("Deactivate account error:", error);

      if (error.message === "User not found") {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to deactivate account",
      });
    }
  }
}

module.exports = new UserController();
