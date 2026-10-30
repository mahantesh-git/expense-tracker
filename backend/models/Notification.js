const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['request_submitted', 'request_approved', 'request_rejected'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExpenseRequest',
    default: null
  },
  read: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// ─── Indexes ──────────────────────────────────────────────────────
// "latest 10 for user" + "unread count" + "mark all read" — one index covers all three
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
