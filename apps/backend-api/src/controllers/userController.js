const userService = require("../services/userService");

class UserController {
  // ==========================
  //Get user profile
  // ==========================
  async getProfile(req, res) {
    try {
      // For compatibility with tests - direct use of User model
      const User = require('../models/User');
      const userId = req.params.userId || req.user._id;
      
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        user,
      });
    } catch (error) {
      console.error("Get profile error:", error);

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
      // Check if user is authorized to update the profile
      const userId = req.params.userId || req.user._id;
      
      // If trying to update another user's profile and not an admin, reject
      if (userId !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to update this profile"
        });
      }
      
      // For compatibility with tests - direct use of User model
      const User = require('../models/User');
      const updates = req.body;
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true }
      );
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      res.json({
        success: true,
        message: "User profile updated successfully",
        user,
      });
    } catch (error) {
      console.error("Update profile error:", error);

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

  // ==========================
  // Delete a user (admin only)
  // ==========================
  async deleteUser(req, res) {
    try {
      const User = require('../models/User');
      
      // First validate if the current user exists and is admin
      const currentUser = await User.findById(req.user._id);
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "User not found"
        });
      }

      // Check if user is admin
      if (currentUser.role !== 'admin') {
        // For security, do a redundant check to ensure user hasn't been deleted already
        const targetUserExists = await User.findById(req.params.userId);
        if (!targetUserExists) {
          return res.status(404).json({
            success: false,
            message: "User not found"
          });
        }
        
        return res.status(403).json({
          success: false,
          message: "Forbidden: Admin access required to delete other users"
        });
      }
      
      const userId = req.params.userId;
      
      // Prevent admin from deleting themselves
      if (userId === req.user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete your own account through this endpoint"
        });
      }
      
      // Delete the user only if the current user is admin (already checked above)
      const result = await User.findByIdAndDelete(userId);
      
      if (!result) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      
      res.json({
        success: true,
        message: "User deleted successfully"
      });
    } catch (error) {
      console.error("Delete user error:", error);
      
      res.status(500).json({
        success: false,
        message: "Failed to delete user"
      });
    }
  }
  
  // ==========================
  // Get all users (admin only)
  // ==========================
  async getUsers(req, res) {
    try {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized: Admin access required"
        });
      }

      // Parse pagination parameters
      const page = Number.parseInt(req.query.page) || 1;
      const limit = Number.parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Get users with pagination
      const User = require('../models/User');
      const users = await User.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      // Get total count for pagination
      const totalUsers = await User.countDocuments();
      const totalPages = Math.ceil(totalUsers / limit);

      res.json({
        success: true,
        users,
        pagination: {
          totalUsers,
          currentPage: page,
          totalPages,
          limit
        }
      });
    } catch (error) {
      console.error("Get all users error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch users"
      });
    }
  }
}

module.exports = new UserController();
