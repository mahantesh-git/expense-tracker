const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
  payer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  description: {
    type: String,
    default: 'Net balance settlement'
  }
}, { timestamps: true });

// ─── Indexes ──────────────────────────────────────────────────────
// Client "my settlements" → appears as payer or receiver, sorted by date
settlementSchema.index({ payer: 1, date: -1 });
settlementSchema.index({ receiver: 1, date: -1 });
// Admin "all settlements" sorted by date
settlementSchema.index({ date: -1 });

module.exports = mongoose.model('Settlement', settlementSchema);
