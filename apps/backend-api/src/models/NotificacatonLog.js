const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema({
  alertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alert',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  method: {
    type: String,
    enum: ['EMAIL', 'PUSH', 'WEBSOCKET'],
    required: true
  },
  status: {
    type: String,
    enum: ['SENT', 'FAILED', 'PENDING'],
    default: 'PENDING'
  },
  message: String,
  errorDetails: String,
  sentAt: Date,
  retryCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

notificationLogSchema.index({ alertId: 1 });
notificationLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);