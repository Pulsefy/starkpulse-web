const { Provider, Contract } = require("starknet");
const passport = require("passport");
const { Strategy } = require("passport-custom");
const authConfig = require("../../../config/auth");
const User = require("../../models/User");
const { verifyMessage } = require("starknet");

const provider = new Provider({
  sequencer: {
    network: authConfig.starknetNetwork,
  },
});

const verifyWalletAuth = async (req, done) => {
  try {
    const { walletAddress, signature, nonce } = req.body;

    // Verify the signature against the nonce
    const isValid = await verifySignature(walletAddress, signature, nonce);
    if (!isValid) {
      return done(null, false, { message: "Invalid signature" });
    }

    // Find or create user
    let user = await User.findOne({ walletAddress });
    if (!user) {
      user = new User({
        walletAddress,
        authMethod: "wallet",
        role: "user",
      });
      await user.save();
    }

    return done(null, user);
  } catch (error) {
    return done(error);
  }
};

const verifySignature = async (address, signature, nonce) => {
  const message = `StarkPulse Auth Nonce: ${nonce}`;
  try {
    return await verifyMessage(message, address, signature);
  } catch (error) {
    return false;
  }
};

passport.use("starknet-wallet", new Strategy(verifyWalletAuth));

module.exports = passport;
