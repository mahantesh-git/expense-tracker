const express = require('express');
const router = express.Router();
const Settlement = require('../models/Settlement');
const { protect, admin } = require('../middleware/auth');
const { sendEmail } = require('../utils/sendEmail');
const User = require('../models/User');

// @route   POST /api/settlements
// @desc    Record a settlement (payment)
// @access  Private (Admin only)
// No transaction needed — single document write is already atomic.
router.post('/', protect, admin, async (req, res) => {
  try {
    const { payer, receiver, amount, description } = req.body;

    const settlement = await Settlement.create({
      payer,
      receiver,
      amount,
      description: description || 'Net balance settlement'
    });

    res.status(201).json(settlement);

    // Fire-and-forget email — response already sent, never blocks the client
    try {
      const [payerUser, receiverUser] = await Promise.all([
        User.findById(payer).select('username email').lean(),
        User.findById(receiver).select('username').lean(),
      ]);

      if (payerUser?.email) {
        const descText = description ? ` for: "${description}"` : '';
        const message = `Hello ${payerUser.username},\n\nYour payment of ₹${amount} to ${receiverUser?.username ?? 'the receiver'}${descText} has been successfully recorded and resolved by the admin.\n\nThank you!`;

        sendEmail({ email: payerUser.email, subject: 'Payment Resolved Confirmation', message })
          .then(() => console.log(`Settlement email sent to ${payerUser.email}`))
          .catch(err => console.error('Failed to send settlement email:', err));
      }
    } catch (emailError) {
      console.error('Failed to prepare settlement email:', emailError);
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/settlements
// @desc    Get all settlements
// @access  Private (Admin gets all, Client gets their own)
router.get('/', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin'
      ? {}
      : { $or: [{ payer: req.user._id }, { receiver: req.user._id }] };

    const settlements = await Settlement
      .find(filter)
      .sort({ date: -1 })
      .populate('payer', 'username')
      .populate('receiver', 'username')
      .lean();

    res.json(settlements);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
