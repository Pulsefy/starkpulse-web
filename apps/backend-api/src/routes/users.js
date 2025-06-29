const express = require("express")
const userController = require("../controllers/userController")
const { validate } = require("../middleware/validation")
const { requireAuth } = require("../middleware/auth")

const router = express.Router()

// ==========================
// User  Routes
// ==========================
router.get("/profile", requireAuth, userController.getProfile)

router.put("/profile", requireAuth, validate("updateProfile"), userController.updateProfile)

router.put("/change-password", requireAuth, validate("changePassword"), userController.changePassword)

// ==========================
// Account Management Routes
// ==========================
router.delete("/account", requireAuth, userController.deleteAccount)

router.get("/export", requireAuth, userController.exportData)

router.put("/deactivate", requireAuth, userController.deactivateAccount)

module.exports = router