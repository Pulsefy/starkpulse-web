const mongoose = require("mongoose");

const biometricCredentialSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    credentialID: { type: String, required: true, unique: true },
    publicKey: { type: String, required: true },
    counter: { type: Number, required: true },
    deviceType: { type: String },
    lastUsed: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "BiometricCredential",
  biometricCredentialSchema,
);
