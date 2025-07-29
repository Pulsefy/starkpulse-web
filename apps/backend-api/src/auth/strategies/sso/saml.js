const passport = require("passport");
const { Strategy: SamlStrategy } = require("passport-saml");
const config = require("../../../config/sso");
const User = require("../../models/User");

const samlStrategy = new SamlStrategy(
  {
    path: config.saml.callbackPath,
    entryPoint: config.saml.entryPoint,
    issuer: config.saml.issuer,
    cert: config.saml.cert,
    identifierFormat: config.saml.identifierFormat,
  },
  async (profile, done) => {
    try {
      const email = profile[config.saml.emailField];
      if (!email) {
        return done(null, false, {
          message: "Email not found in SAML response",
        });
      }

      let user = await User.findOne({ email, authMethod: "sso" });
      if (!user) {
        user = new User({
          email,
          authMethod: "sso",
          ssoProvider: "saml",
          ssoId: profile.nameID,
          role: "user",
          isEmailVerified: true,
        });
        await user.save();
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  },
);

passport.use("saml", samlStrategy);

module.exports = passport;
