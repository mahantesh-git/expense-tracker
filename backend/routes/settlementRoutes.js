const express = require('express');
const router = express.Router();
const Settlement = require('../models/Settlement');
const { protect, admin } = require('../middleware/auth');

// @route   POST /api/settlements
// @desc    Record a settlement (payment)
// @access  Private (Admin only)
router.post('/', protect, admin, async (req, res) => {
  try {
    const { payer, receiver, amount } = req.body;
    
    const settlement = await Settlement.create({
      payer,
      receiver,
      amount
    });

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
