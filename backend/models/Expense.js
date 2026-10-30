const mongoose = require('mongoose');

const splitSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amountOwed: {
    type: Number,
    required: true
  }
}, { _id: false });

const expenseSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  payer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  splits: [splitSchema],
  date: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// ─── Indexes ──────────────────────────────────────────────────────
// Admin "all expenses" → sorted by date
expenseSchema.index({ date: -1 });
// Client "my expenses" → filter by payer or split participant, sorted by date
expenseSchema.index({ payer: 1, date: -1 });
expenseSchema.index({ 'splits.user': 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
