const express = require('express');
const router = express.Router();
const ExpenseRequest = require('../models/ExpenseRequest');
const Expense = require('../models/Expense');
const { protect, admin } = require('../middleware/auth');
const Notification = require('../models/Notification');
const User = require('../models/User');
const mongoose = require('mongoose');

// ─────────────────────────────────────────────
// @route   POST /api/expense-requests
// @desc    Client submits a new expense request
// @access  Private (Client)
// ─────────────────────────────────────────────
// KEEP transaction: creates ExpenseRequest + Notification together.
router.post('/', protect, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { description, amount, splitType, splits } = req.body;

    if (!description || !amount || !splitType || !splits || splits.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'All fields are required' });
    }

    const splitTotal = splits.reduce((acc, s) => acc + s.amountOwed, 0);
    if (splitTotal > Number(amount) + 0.01) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: `Others' shares (₹${splitTotal.toFixed(2)}) cannot exceed the total (₹${Number(amount).toFixed(2)})`
      });
    }
    if (splitTotal < 0.01) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Each participant must owe at least ₹0.01' });
    }

    const requestArray = await ExpenseRequest.create([{
      description,
      amount: Number(amount),
      requestedBy: req.user._id,
      payer: req.user._id,
      splitType,
      splits,
      status: 'pending'
    }], { session });

    const request = requestArray[0];

    // Notify admin — run in parallel with the find
    const adminUser = await User.findOne({ role: 'admin' }).select('_id').lean().session(session);
    if (adminUser) {
      await Notification.create([{
        recipient: adminUser._id,
        type: 'request_submitted',
        title: 'New Expense Request',
        message: `${req.user.username} submitted a new request for ₹${Number(amount).toFixed(2)} (${description}).`,
        relatedRequestId: request._id
      }], { session });
    }

    await session.commitTransaction();
    session.endSession();

    const populated = await ExpenseRequest.findById(request._id)
      .populate('requestedBy', 'username')
      .populate('payer', 'username')
      .populate('splits.user', 'username')
      .lean();

    res.status(201).json(populated);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─────────────────────────────────────────────
// @route   GET /api/expense-requests
// @desc    Client: get own requests. Admin: get ALL requests
// @access  Private
// ─────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin'
      ? {}
      : { requestedBy: req.user._id };

    const requests = await ExpenseRequest
      .find(filter)
      .sort({ createdAt: -1 })
      .populate('requestedBy', 'username')
      .populate('payer', 'username')
      .populate('splits.user', 'username')
      .lean();

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// @route   GET /api/expense-requests/pending-count
// @desc    Admin: get count of pending requests
// @access  Admin
// ─────────────────────────────────────────────
router.get('/pending-count', protect, admin, async (req, res) => {
  try {
    const count = await ExpenseRequest.countDocuments({ status: 'pending' });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// @route   PUT /api/expense-requests/:id/approve
// @desc    Admin approves a request → creates real Expense
// @access  Admin
// ─────────────────────────────────────────────
// KEEP transaction: creates Expense + updates ExpenseRequest + creates Notification.
router.put('/:id/approve', protect, admin, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const expRequest = await ExpenseRequest.findById(req.params.id).session(session);

    if (!expRequest) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Request not found' });
    }
    if (expRequest.status !== 'pending') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: `Request is already ${expRequest.status}` });
    }

    const plainSplits = expRequest.splits.map(s => ({
      user: s.user,
      amountOwed: s.amountOwed
    }));

    const expenseArray = await Expense.create([{
      description: expRequest.description,
      amount: expRequest.amount,
      payer: expRequest.payer,
      splits: plainSplits,
      date: expRequest.date
    }], { session });

    const expense = expenseArray[0];

    expRequest.status = 'approved';
    expRequest.adminNote = req.body?.adminNote || null;
    expRequest.approvedExpenseId = expense._id;
    await expRequest.save({ session });

    await Notification.create([{
      recipient: expRequest.requestedBy,
      type: 'request_approved',
      title: 'Expense Request Approved',
      message: `Your request for ₹${expRequest.amount.toFixed(2)} (${expRequest.description}) was approved.`,
      relatedRequestId: expRequest._id
    }], { session });

    await session.commitTransaction();
    session.endSession();

    const populated = await ExpenseRequest.findById(expRequest._id)
      .populate('requestedBy', 'username')
      .populate('payer', 'username')
      .populate('splits.user', 'username')
      .lean();

    res.json({ request: populated, expense });
  } catch (error) {
    console.error('Approve error:', error);
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─────────────────────────────────────────────
// @route   PUT /api/expense-requests/:id/reject
// @desc    Admin rejects a request
// @access  Admin
// ─────────────────────────────────────────────
// KEEP transaction: updates ExpenseRequest + creates Notification.
router.put('/:id/reject', protect, admin, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const expRequest = await ExpenseRequest.findById(req.params.id).session(session);

    if (!expRequest) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Request not found' });
    }
    if (expRequest.status !== 'pending') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: `Request is already ${expRequest.status}` });
    }

    expRequest.status = 'rejected';
    expRequest.adminNote = req.body.adminNote || 'Rejected by admin';
    await expRequest.save({ session });

    await Notification.create([{
      recipient: expRequest.requestedBy,
      type: 'request_rejected',
      title: 'Expense Request Rejected',
      message: `Your request for ₹${expRequest.amount.toFixed(2)} (${expRequest.description}) was rejected.`,
      relatedRequestId: expRequest._id
    }], { session });

    await session.commitTransaction();
    session.endSession();

    const populated = await ExpenseRequest.findById(expRequest._id)
      .populate('requestedBy', 'username')
      .populate('payer', 'username')
      .populate('splits.user', 'username')
      .lean();

    res.json(populated);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─────────────────────────────────────────────
// @route   DELETE /api/expense-requests/:id
// @desc    Client cancels their own pending request
// @access  Private (Client, own request only)
// ─────────────────────────────────────────────
// No transaction — single document delete is already atomic.
router.delete('/:id', protect, async (req, res) => {
  try {
    const expRequest = await ExpenseRequest.findById(req.params.id).lean();

    if (!expRequest) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const isOwner = String(expRequest.requestedBy) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (expRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending requests can be cancelled' });
    }

    await ExpenseRequest.findByIdAndDelete(req.params.id);
    res.json({ message: 'Request cancelled successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
