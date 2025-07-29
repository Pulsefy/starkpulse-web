const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ipAddress: { type: String },
    userAgent: { type: String },
    metadata: { type: Object },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
