const mongoose = require('mongoose');

const paymentClaimSchema = new mongoose.Schema({
  payer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  payee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  utrNumber: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  adminNote: {
    type: String,
    default: null,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  isPartial: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Prevent same UTR from being submitted twice
paymentClaimSchema.index({ utrNumber: 1 }, { unique: true });
// Speed up payer+payee+status lookups
paymentClaimSchema.index({ payer: 1, payee: 1, status: 1 });

module.exports = mongoose.model('PaymentClaim', paymentClaimSchema);
