const express = require("express")
const authController = require("../controllers/authController")
const { validate } = require("../middleware/validation")
const { requireAuth, requireGuest } = require("../middleware/auth")
const { authLimiter } = require("../middleware/rateLimiter")

const router = express.Router()

router.use(authLimiter)

// ==========================
// Authentication Routes
// ==========================
router.post("/register", requireGuest, validate("register"), authController.register)
router.post("/login", requireGuest, validate("login"), authController.login)
router.post("/refresh", authController.refreshToken)
router.post("/logout", requireAuth, authController.logout)
router.post("/logout-all", requireAuth, authController.logoutAll)

// ==========================
// Password Management Routes
// ==========================
router.post("/forgot-password", requireGuest, validate("forgotPassword"), authController.forgotPassword)
router.post("/reset-password", requireGuest, validate("resetPassword"), authController.resetPassword)

// ==========================
// User Info Routes
// ==========================
router.get("/me", requireAuth, authController.getCurrentUser)
router.get("/sessions", requireAuth, authController.getSessions)

module.exports = router