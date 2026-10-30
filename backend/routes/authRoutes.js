const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { protect, admin, invalidateUserCache } = require('../middleware/auth');
const { sendEmail } = require('../utils/sendEmail');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '30d',
  });
};

// @route   POST /api/auth/login
// @desc    Auth user & get token
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    // .lean() — plain JS object, no hydration cost
    const user = await User.findOne({ username }).lean();

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    if (user.isActive === false) {
      return res.status(403).json({ message: 'Your account has been deactivated' });
    }
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    res.json({
      _id: user._id,
      username: user.username,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/register
// @desc    Register a new client (Admin only)
// No transaction needed — single document write is already atomic.
router.post('/register', protect, admin, async (req, res) => {
  try {
    const { email, username } = req.body;
    const Username = username
      ? username
      : email.trim().split('@')[0].toLowerCase();

    const userExists = await User.findOne({
      $or: [{ username: Username }, { email }],
    }).lean();

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(Username, salt);

    const user = await User.create({
      email,
      username: Username,
      password: hashedPassword,
      role: 'client',
    });

    res.status(201).json({
      _id: user._id,
      username: user.username,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/reset-password-otp/:email
// @desc    Send OTP to user's email (Admin only)
// No transaction — single document update.
router.post('/reset-password-otp/:email', protect, admin, async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.otpExpiry && user.otpExpiry > Date.now()) {
      return res.status(400).json({ success: false, message: 'Retry after a few minutes' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    user.otp = String(otp);
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // Fire-and-forget — do not block the response waiting for email
    const options = {
      email: user.email,
      subject: 'OTP for resetting your password',
      message: `Your requested OTP for resetting your password is: ${otp}`,
      html: `<h1>Your requested OTP for resetting your password is: ${otp}</h1>`,
    };
    sendEmail(options).catch(err => console.error('Failed to send OTP', err));

    return res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/reset-password/:userId
// @desc    Reset a user's password using OTP (Admin only)
// No transaction — single document update.
router.put('/reset-password/:userId', protect, admin, async (req, res) => {
  try {
    const { newPassword, otp, email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (String(user.otp) !== String(otp)) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    if (!user.otpExpiry || user.otpExpiry < Date.now()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    // Evict cache so the user's next request picks up the new state
    invalidateUserCache(user._id);

    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/users
// @desc    Get all users (Admin only)
router.get('/users', protect, admin, async (req, res) => {
  try {
    const users = await User.find({}).select('-password').lean();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/peers
// @desc    Get all active clients — for split participant selection
router.get('/peers', protect, async (req, res) => {
  try {
    const users = await User
      .find({ role: 'client', isActive: { $ne: false } })
      .select('-password -otp -otpExpiry')
      .lean();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
router.get('/me', protect, async (req, res) => {
  try {
    // req.user is already populated by protect middleware (cached)
    const user = await User.findById(req.user._id).select('-password').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/auth/profile
// @desc    Update current user username
// No transaction — single document update.
router.patch('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.body.username !== undefined && req.body.username !== user.username) {
      const existing = await User.findOne({ username: req.body.username }).lean();
      if (existing) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
      user.username = req.body.username;
    }

    await user.save();
    // Invalidate so the next request sees the new username
    invalidateUserCache(user._id);

    return res.json({ _id: user._id, username: user.username, role: user.role });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change current user password
// No transaction — single document update.
router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/auth/users/:id/status
// @desc    Toggle user active status (Admin only)
// No transaction — single document update.
router.patch('/users/:id/status', protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = !user.isActive;
    await user.save();

    // Clear cache so the next request re-checks isActive from the DB
    invalidateUserCache(user._id);

    return res.json({ _id: user._id, username: user.username, isActive: user.isActive });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;