const {
  generateRegistrationOptions,
  verifyRegistration,
  generateAuthenticationOptions,
  verifyAuthentication,
} = require("../auth/strategies/biometric");
const User = require("../models/User");
const audit = require("../services/audit");

exports.generateRegistrationOptions = async (req, res) => {
  try {
    const options = await generateRegistrationOptions(req.user);
    res.json(options);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.verifyRegistration = async (req, res) => {
  try {
    const verification = await verifyRegistration(req.user, req.body);
    if (verification.verified) {
      audit.log({
        action: "biometric_registered",
        userId: req.user.id,
        metadata: {
          device:
            req.body.response.clientExtensionResults?.devicePubKey?.deviceType,
        },
      });
    }
    res.json({ verified: verification.verified });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.generateAuthenticationOptions = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const options = await generateAuthenticationOptions(user);
    res.json(options);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.verifyAuthentication = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const verification = await verifyAuthentication(user, req.body);
    if (verification.verified) {
      const tokens = await generateTokens(user);

      audit.log({
        action: "biometric_login",
        userId: user.id,
      });

      return res.json({ ...tokens, user: user.toJSON() });
    }

    res.status(401).json({ message: "Biometric verification failed" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
