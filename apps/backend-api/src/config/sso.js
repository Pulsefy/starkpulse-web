module.exports = {
  saml: {
    entryPoint: process.env.SAML_ENTRY_POINT,
    issuer: process.env.SAML_ISSUER || "starkpulse",
    callbackPath: process.env.SAML_CALLBACK_PATH || "/auth/saml/callback",
    cert: process.env.SAML_CERT,
    emailField:
      process.env.SAML_EMAIL_FIELD ||
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    identifierFormat:
      process.env.SAML_IDENTIFIER_FORMAT ||
      "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  },
  oauth: {
    authorizationURL: process.env.OAUTH_AUTHORIZATION_URL,
    tokenURL: process.env.OAUTH_TOKEN_URL,
    userInfoURL: process.env.OAUTH_USER_INFO_URL,
    clientID: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    callbackURL: process.env.OAUTH_CALLBACK_URL || "/auth/oauth/callback",
    scope: process.env.OAUTH_SCOPE || "openid email profile",
  },
  enterprise: {
    jwtSecret: process.env.ENTERPRISE_JWT_SECRET,
    issuer: process.env.ENTERPRISE_ISSUER,
    audience: process.env.ENTERPRISE_AUDIENCE || "starkpulse",
  },
};
