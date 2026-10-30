const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

// ─────────────────────────────────────────────
// @route   GET /api/notifications
// @desc    Get user's latest 10 notifications
// @access  Private
// ─────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const notifications = await Notification
      .find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(); // plain JS objects — no Mongoose hydration cost
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─────────────────────────────────────────────
// @route   GET /api/notifications/unread-count
// @desc    Get count of unread notifications
// @access  Private
// ─────────────────────────────────────────────
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      read: false
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─────────────────────────────────────────────
// @route   PUT /api/notifications/:id/read
// @desc    Mark a single notification as read
// @access  Private
// ─────────────────────────────────────────────
router.put('/:id/read', protect, async (req, res) => {
  try {
    // findOneAndUpdate is a single atomic write — no need to fetch then save
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { read: true } },
      { new: true, lean: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─────────────────────────────────────────────
// @route   PUT /api/notifications/read-all
// @desc    Mark all user's notifications as read
// @access  Private
// ─────────────────────────────────────────────
router.put('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { $set: { read: true } }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
