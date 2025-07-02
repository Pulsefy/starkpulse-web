const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    alertType: {
      type: String,
      enum: ["PRICE_ABOVE", "PRICE_BELOW", "PERCENTAGE_CHANGE"],
      required: true,
    },
    targetPrice: {
      type: Number,
      required: function () {
        return (
          this.alertType === "PRICE_ABOVE" || this.alertType === "PRICE_BELOW"
        );
      },
    },
    percentageChange: {
      type: Number,
      required: function () {
        return this.alertType === "PERCENTAGE_CHANGE";
      },
    },
    timeframe: {
      type: String,
      enum: ["1h", "24h", "7d"],
      default: "24h",
      required: function () {
        return this.alertType === "PERCENTAGE_CHANGE";
      },
    },
    deliveryMethods: [
      {
        type: String,
        enum: ["EMAIL", "PUSH", "WEBSOCKET"],
        required: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isTriggered: {
      type: Boolean,
      default: false,
    },
    triggeredAt: Date,
    lastChecked: Date,
    createdAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      currentPrice: Number,
      triggerPrice: Number,
      changePercentage: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient querying
alertSchema.index({ isActive: 1, isTriggered: 1 });
alertSchema.index({ symbol: 1, isActive: 1 });
alertSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model("Alert", alertSchema);
