const express = require('express');
const router = express.Router();
const Settlement = require('../models/Settlement');
const { protect, admin } = require('../middleware/auth');

const { sendEmail } = require('../utils/sendEmail');
const User = require('../models/User');

// @route   POST /api/settlements
// @desc    Record a settlement (payment)
// @access  Private (Admin only)
router.post('/', protect, admin, async (req, res) => {
  try {
    const { payer, receiver, amount, description } = req.body;
    
    const settlement = await Settlement.create({
      payer,
      receiver,
      amount,
      description: description || 'Net balance settlement'
    });

    // Send email to the payer
    try {
      const payerUser = await User.findById(payer);
      const receiverUser = await User.findById(receiver);

      if (payerUser && payerUser.email) {
        const descText = description ? ` for: "${description}"` : '';
        const message = `Hello ${payerUser.username},\n\nYour payment of ₹${amount} to ${receiverUser ? receiverUser.username : 'the receiver'}${descText} has been successfully recorded and resolved by the admin.\n\nThank you!`;
        
        await sendEmail({
          email: payerUser.email,
          subject: 'Payment Resolved Confirmation',
          message
        });
        console.log(`Settlement email sent to ${payerUser.email}`);
      }
    } catch (emailError) {
      console.error('Failed to send settlement email:', emailError);
      // We don't want to fail the request if the email fails
    }

    res.status(201).json(settlement);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/settlements
// @desc    Get all settlements
// @access  Private (Admin gets all, Client gets their own)
router.get('/', protect, async (req, res) => {
  try {
    let settlements;
    if (req.user.role === 'admin') {
      settlements = await Settlement.find({}).sort({ date: -1 }).populate('payer', 'username').populate('receiver', 'username');
    } else {
      settlements = await Settlement.find({
        $or: [
          { payer: req.user._id },
          { receiver: req.user._id }
        ]
      }).sort({ date: -1 }).populate('payer', 'username').populate('receiver', 'username');
    }
    res.json(settlements);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
