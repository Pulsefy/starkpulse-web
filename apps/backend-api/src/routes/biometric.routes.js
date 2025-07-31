const express = require("express");
const router = express.Router();
const biometricController = require("../controllers/biometricController");
const authMiddleware = require("../middleware/auth");

// Registration
router.post(
  "/register/options",
  authMiddleware.authenticateJWT,
  biometricController.generateRegistrationOptions,
);
router.post(
  "/register/verify",
  authMiddleware.authenticateJWT,
  biometricController.verifyRegistration,
);

// Authentication
router.post("/auth/options", biometricController.generateAuthenticationOptions);
router.post("/auth/verify", biometricController.verifyAuthentication);

module.exports = router;
