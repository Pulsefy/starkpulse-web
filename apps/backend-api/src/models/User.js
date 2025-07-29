const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const searchService = require("../services/search.service");

const userSchema = new mongoose.Schema(
  {
    // Identity fields
    firstName: { type: String, trim: true, minlength: 2, maxlength: 50 },
    lastName: { type: String, trim: true, minlength: 2, maxlength: 50 },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    walletAddress: { type: String, unique: true, sparse: true },
    authMethod: {
      type: String,
      required: true,
      enum: ["email", "wallet", "sso", "biometric"],
    },

    // Auth fields
    password: { type: String, minlength: 8, select: false },
    ssoProvider: { type: String, enum: ["saml", "oauth", "enterprise"] },
    ssoId: { type: String },
    isEmailVerified: { type: Boolean, default: false },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, select: false },
    biometricChallenge: { type: String, select: false },

    // Account controls
    role: {
      type: String,
      enum: ["user", "admin", "institutional"],
      default: "user",
    },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    passwordChangedAt: { type: Date },

    // Tokens
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    refreshTokens: [
      {
        token: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
        deviceInfo: { type: String, default: "Unknown Device" },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationExpires;
        delete ret.mfaSecret;
        delete ret.biometricChallenge;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Virtual
userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Indexes
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ passwordResetToken: 1 });

// Password hashing
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  if (!this.isNew) this.passwordChangedAt = new Date();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Password comparison
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Login attempt handling
userSchema.methods.incrementLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil > Date.now())
    throw new Error("Account locked");
  this.loginAttempts += 1;
  if (this.loginAttempts >= 5) {
    this.lockUntil = Date.now() + 30 * 60 * 1000; // 30 minutes
  }
  await this.save();
};

userSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  await this.save();
};

// Email verification token
userSchema.methods.createEmailVerificationToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  return token;
};

// Password reset token
userSchema.methods.createPasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000;
  return token;
};

// Refresh token management
userSchema.methods.addRefreshToken = function (
  token,
  expiresAt,
  deviceInfo = "Unknown Device",
) {
  this.refreshTokens.push({ token, expiresAt, deviceInfo });
  if (this.refreshTokens.length > 5)
    this.refreshTokens = this.refreshTokens.slice(-5);
  return this.save();
};

userSchema.methods.removeRefreshToken = function (token) {
  this.refreshTokens = this.refreshTokens.filter((rt) => rt.token !== token);
  return this.save();
};

userSchema.methods.hasValidRefreshToken = function (token) {
  return this.refreshTokens.some(
    (rt) => rt.token === token && rt.expiresAt > new Date(),
  );
};

// Search index post hook
userSchema.post("save", function (doc) {
  searchService
    .indexDocument({
      index: "users",
      id: doc._id.toString(),
      body: doc.toObject(),
    })
    .catch(() => {});
});

module.exports = mongoose.model("User", userSchema);
