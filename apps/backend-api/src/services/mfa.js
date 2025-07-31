const speakeasy = require("speakeasy");

exports.generateMfaSecret = (user) => {
  return speakeasy.generateSecret({
    name: `StarkPulse:${user.email}`,
    issuer: "StarkPulse",
  });
};

exports.verifyMfaToken = (user, token) => {
  return speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: "base32",
    token,
    window: 1,
  });
};
