const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../../config/sso");
const audit = require("../services/audit");

exports.enterpriseLogin = async (req, res) => {
  // Redirect to enterprise login page
  const state = jwt.sign(
    { redirect: req.query.redirect || "/" },
    config.enterprise.jwtSecret,
    { expiresIn: "5m" },
  );

  const loginUrl = `${config.enterprise.loginUrl}?state=${state}`;
  res.redirect(loginUrl);
};

exports.enterpriseCallback = async (req, res) => {
  try {
    const { token, state } = req.body;

    // Verify state
    const decodedState = jwt.verify(state, config.enterprise.jwtSecret);

    // Verify enterprise token
    const payload = jwt.verify(token, config.enterprise.jwtSecret, {
      issuer: config.enterprise.issuer,
      audience: config.enterprise.audience,
    });

    let user = await User.findOne({ email: payload.email, authMethod: "sso" });
    if (!user) {
      user = new User({
        email: payload.email,
        authMethod: "sso",
        ssoProvider: "enterprise",
        ssoId: payload.sub,
        role: payload.role || "user",
        isEmailVerified: true,
      });
      await user.save();
    }

    const tokens = await generateTokens(user);

    audit.log({
      action: "enterprise_sso_login",
      userId: user.id,
      metadata: { provider: "enterprise" },
    });

    res.json({ ...tokens, redirect: decodedState.redirect });
  } catch (error) {
    res.status(401).json({ message: "Invalid enterprise token" });
  }
};
