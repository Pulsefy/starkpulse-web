const express = require("express");
const router = express.Router();
const passport = require("passport");
const authController = require("../controllers/authController");
const ssoController = require("../controllers/ssoController");

// SAML SSO
router.get("/saml/login", passport.authenticate("saml"));
router.post(
  "/saml/callback",
  passport.authenticate("saml", { session: false }),
  authController.login,
);

// OAuth SSO
router.get("/oauth/login", passport.authenticate("oauth2"));
router.get(
  "/oauth/callback",
  passport.authenticate("oauth2", { session: false }),
  authController.login,
);

// Enterprise SSO
router.post("/enterprise/login", ssoController.enterpriseLogin);
router.post("/enterprise/callback", ssoController.enterpriseCallback);

module.exports = router;
