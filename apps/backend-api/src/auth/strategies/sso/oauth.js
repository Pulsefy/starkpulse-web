const passport = require("passport");
const { Strategy: OAuth2Strategy } = require("passport-oauth2");
const config = require("../../../config/sso");
const User = require("../../models/User");

const oauthStrategy = new OAuth2Strategy(
  {
    authorizationURL: config.oauth.authorizationURL,
    tokenURL: config.oauth.tokenURL,
    clientID: config.oauth.clientID,
    clientSecret: config.oauth.clientSecret,
    callbackURL: config.oauth.callbackURL,
    scope: config.oauth.scope,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Get user info from provider
      const userInfo = await fetchUserInfo(accessToken);
      const email = userInfo.email;

      let user = await User.findOne({ email, authMethod: "sso" });
      if (!user) {
        user = new User({
          email,
          authMethod: "sso",
          ssoProvider: "oauth",
          ssoId: userInfo.id,
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

async function fetchUserInfo(accessToken) {
  // Implementation depends on the OAuth provider
  const response = await fetch(config.oauth.userInfoURL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.json();
}

passport.use("oauth2", oauthStrategy);

module.exports = passport;
