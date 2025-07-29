const express = require("express");
const router = express.Router();
const passport = require("passport");
const authController = require("../controllers/authController");
const { rateLimiter } = require("../auth/middleware/security/rateLimit");
const { userRegisterSchema, userLoginSchema } = require("../auth/schemas/user");
const validate = require("../middleware/validate");

// Registration
router.post("/register", validate(userRegisterSchema), authController.register);

// Email Login
router.post(
  "/login/email",
  rateLimiter("login"),
  validate(userLoginSchema),
  passport.authenticate("local", { session: false }),
  authController.login,
);

// Wallet Login
router.post(
  "/login/wallet",
  rateLimiter("login"),
  passport.authenticate("starknet-wallet", { session: false }),
  authController.login,
);

// Refresh Token
router.post("/refresh", rateLimiter("api"), authController.refreshToken);

// Logout
router.post("/logout", authController.authenticateJWT, authController.logout);

module.exports = router;
