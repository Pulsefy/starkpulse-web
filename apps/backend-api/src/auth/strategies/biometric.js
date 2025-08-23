const { WebAuthn } = require("@simplewebauthn/server");
const User = require("../../models/User");
const BiometricCredential = require("../../models/BiometricCredential");

const rpName = "StarkPulse";
const rpID = process.env.RP_ID || "localhost";
const origin = process.env.ORIGIN || `https://${rpID}`;

exports.generateRegistrationOptions = async (user) => {
  const userCredentials = await BiometricCredential.find({ user: user._id });

  const options = await WebAuthn.generateRegistrationOptions({
    rpName,
    rpID,
    userID: user._id.toString(),
    userName: user.email || user.walletAddress,
    attestationType: "none",
    excludeCredentials: userCredentials.map((cred) => ({
      id: cred.credentialID,
      type: "public-key",
    })),
  });

  // Store challenge in user session
  user.biometricChallenge = options.challenge;
  await user.save();

  return options;
};

exports.verifyRegistration = async (user, attestationResponse) => {
  const expectedChallenge = user.biometricChallenge;

  const verification = await WebAuthn.verifyRegistrationResponse({
    response: attestationResponse,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (verification.verified) {
    const { credentialID, credentialPublicKey } = verification.registrationInfo;

    await BiometricCredential.create({
      user: user._id,
      credentialID,
      publicKey: credentialPublicKey,
      counter: verification.registrationInfo.counter,
      deviceType:
        attestationResponse.response.clientExtensionResults?.devicePubKey
          ?.deviceType || "unknown",
    });

    user.biometricChallenge = null;
    await user.save();
  }

  return verification;
};

exports.generateAuthenticationOptions = async (user) => {
  const credentials = await BiometricCredential.find({ user: user._id });

  const options = await WebAuthn.generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map((cred) => ({
      id: cred.credentialID,
      type: "public-key",
      transports: ["internal", "hybrid"],
    })),
    userVerification: "required",
  });

  user.biometricChallenge = options.challenge;
  await user.save();

  return options;
};

exports.verifyAuthentication = async (user, assertionResponse) => {
  const credential = await BiometricCredential.findOne({
    user: user._id,
    credentialID: assertionResponse.id,
  });

  if (!credential) {
    throw new Error("Credential not found");
  }

  const expectedChallenge = user.biometricChallenge;
  const verification = await WebAuthn.verifyAuthenticationResponse({
    response: assertionResponse,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    authenticator: {
      credentialID: credential.credentialID,
      credentialPublicKey: credential.publicKey,
      counter: credential.counter,
    },
  });

  if (verification.verified) {
    credential.counter = verification.authenticationInfo.newCounter;
    await credential.save();
    user.biometricChallenge = null;
    await user.save();
  }

  return verification;
};
