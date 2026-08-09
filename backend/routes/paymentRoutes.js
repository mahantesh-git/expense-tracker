const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PaymentClaim = require('../models/PaymentClaim');
const Settlement = require('../models/Settlement');
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');
const { sendEmail } = require('../utils/sendEmail');

// UPI ID format validator
const UPI_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/;

// ─── POST /api/payments/claim ────────────────────────────────
// Client submits "I've Paid" claim with UTR number
router.post('/claim', protect, async (req, res) => {
  const { payeeId, amount, utrNumber } = req.body;

  // 1. Validate UTR format (12 digits)
  if (!utrNumber || !/^\d{12}$/.test(utrNumber.trim())) {
    return res.status(400).json({ message: 'UTR must be exactly 12 digits.' });
  }

  // 2. Validate amount
  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than 0.' });
  }

  // 3. Prevent self-payment
  if (String(payeeId) === String(req.user._id)) {
    return res.status(400).json({ message: 'Cannot submit a payment claim to yourself.' });
  }

  // 4. Check payee exists
  const payee = await User.findById(payeeId);
  if (!payee) {
    return res.status(404).json({ message: 'Payee user not found.' });
  }

  // 5. Duplicate UTR check
  const existingUTR = await PaymentClaim.findOne({ utrNumber: utrNumber.trim() });
  if (existingUTR) {
    return res.status(400).json({ message: 'This UTR has already been submitted.' });
  }

  // 6. Block duplicate pending claim for same payer-payee pair
  const pendingClaim = await PaymentClaim.findOne({
    payer: req.user._id,
    payee: payeeId,
    status: 'pending',
  });
  if (pendingClaim) {
    return res.status(409).json({
      message: 'You already have a pending claim for this person. Wait for admin review or cancel it first.',
    });
  }

  try {
    const claim = await PaymentClaim.create({
      payer: req.user._id,
      payee: payeeId,
      amount: Number(amount),
      utrNumber: utrNumber.trim(),
    });

    // Notify admin(s) via email
    try {
      const admins = await User.find({ role: 'admin', email: { $ne: null } });
      const payerUser = req.user;
      for (const adminUser of admins) {
        sendEmail({
          email: adminUser.email,
          subject: 'Payment Claim Submitted — Action Required',
          message: `${payerUser.username} claims they paid ₹${amount} to ${payee.username}.\nUTR: ${utrNumber}\n\nPlease review and approve or reject this claim in the admin dashboard.`,
        }).catch(err => console.error('Failed to send claim email:', err));
      }
    } catch (_) {}

    res.status(201).json(claim);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'This UTR has already been submitted.' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── DELETE /api/payments/claim/:id ─────────────────────────
// Client cancels their own PENDING claim
router.delete('/claim/:id', protect, async (req, res) => {
  try {
    const claim = await PaymentClaim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: 'Claim not found.' });
    if (String(claim.payer) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to cancel this claim.' });
    }
    if (claim.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending claims can be cancelled.' });
    }
    await claim.deleteOne();
    res.json({ message: 'Claim cancelled successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── PATCH /api/payments/claim/:id/approve ──────────────────
// Admin approves → auto-creates settlement → resolves balance
router.patch('/claim/:id/approve', protect, admin, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Atomic update — only succeeds if still pending
    const claim = await PaymentClaim.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      { status: 'approved', approvedBy: req.user._id },
      { new: true, session }
    ).populate('payer', 'username email').populate('payee', 'username email');

    if (!claim) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'This claim has already been processed or does not exist.' });
    }

    // Auto-create settlement to resolve balance
    await Settlement.create([{
      payer: claim.payer._id,
      receiver: claim.payee._id,
      amount: claim.amount,
      description: `UPI Payment — UTR: ${claim.utrNumber}`,
    }], { session });

    await session.commitTransaction();
    session.endSession();

    // Notify payer by email
    try {
      if (claim.payer.email) {
        sendEmail({
          email: claim.payer.email,
          subject: '✅ Payment Approved — Balance Resolved',
          message: `Hello ${claim.payer.username},\n\nYour payment of ₹${claim.amount} to ${claim.payee.username} (UTR: ${claim.utrNumber}) has been approved by the admin.\n\nYour balance has been updated accordingly.`,
        }).catch(err => console.error('Failed to send approval email:', err));
      }
    } catch (_) {}

    res.json({ message: 'Claim approved and settlement recorded.', claim });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
      session.endSession();
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── PATCH /api/payments/claim/:id/reject ───────────────────
// Admin rejects — reason is required
router.patch('/claim/:id/reject', protect, admin, async (req, res) => {
  const { adminNote } = req.body;

  if (!adminNote || !adminNote.trim()) {
    return res.status(400).json({ message: 'A rejection reason is required.' });
  }

  try {
    const claim = await PaymentClaim.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      { status: 'rejected', adminNote: adminNote.trim(), approvedBy: req.user._id },
      { new: true }
    ).populate('payer', 'username email').populate('payee', 'username');

    if (!claim) {
      return res.status(400).json({ message: 'This claim has already been processed or does not exist.' });
    }

    // Notify payer
    try {
      if (claim.payer.email) {
        sendEmail({
          email: claim.payer.email,
          subject: '❌ Payment Claim Rejected',
          message: `Hello ${claim.payer.username},\n\nYour payment claim of ₹${claim.amount} to ${claim.payee.username} (UTR: ${claim.utrNumber}) was rejected.\n\nReason: ${adminNote}\n\nPlease resubmit with the correct details.`,
        }).catch(err => console.error('Failed to send rejection email:', err));
      }
    } catch (_) {}

    res.json({ message: 'Claim rejected.', claim });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── GET /api/payments/claims ────────────────────────────────
// Client: own claims. Admin: all claims (filterable by ?status=pending)
router.get('/claims', protect, async (req, res) => {
  try {
    const { status } = req.query;
    let filter = {};

    if (req.user.role === 'admin') {
      if (status) filter.status = status;
    } else {
      filter.payer = req.user._id;
      if (status) filter.status = status;
    }

    const claims = await PaymentClaim.find(filter)
      .sort({ createdAt: -1 })
      .populate('payer', 'username')
      .populate('payee', 'username')
      .populate('approvedBy', 'username');

    res.json(claims);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── GET /api/payments/upi/:userId ──────────────────────────
// Fetch any user's UPI ID (for Pay Now modal)
router.get('/upi/:userId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('username upiId');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ username: user.username, upiId: user.upiId });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
