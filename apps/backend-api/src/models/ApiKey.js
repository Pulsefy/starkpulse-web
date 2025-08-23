const mongoose = require("mongoose");

const apiKeySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    permissions: [{ type: String }],
    expiresAt: { type: Date },
    lastUsed: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ApiKey", apiKeySchema);
