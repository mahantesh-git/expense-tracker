const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');
const { sendEmail } = require('../utils/sendEmail');
const mongoose = require('mongoose');

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
    const user = await User.findOne({ username: username } || { email: username });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user._id,
        username: user.username,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid username or password' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/register
// @desc    Register a new client (Admin only)
router.post('/register', protect, admin, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { email, username } = req.body;
    const userExists = await User.findOne({ $or: [{ username: username }, { email: email }] }).session(session);
    let Username;
    if (!username) {
      Username = email.trim().split('@')[0].toLowerCase();
    } else {
      Username = username;
    }

    if (userExists) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    // User requested password to be the same as username
    const hashedPassword = await bcrypt.hash(Username, salt);

    const userArray = await User.create([{
      email,
      username: Username,
      password: hashedPassword,
      role: 'client',
    }], { session });

    const user = userArray[0];

    if (user) {
      await session.commitTransaction();
      session.endSession();
      res.status(201).json({
        _id: user._id,
        username: user.username,
        role: user.role,
      });
    } else {
      await session.abortTransaction();
      session.endSession();
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/reset-password/:userId
// @desc    Reset a user's password (Admin only)

router.post('/reset-password-otp/:email', protect, admin, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { email } = req.params;
    const user = await User.findOne({ email }).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.otpExpiry > Date.now()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: `retry after few miniutes` });
    }
    const otp = Math.floor(100000 + Math.random() * 900000);
    console.log(otp)
    user.otp = otp;
    user.otpExpiry = Date.now() + 10 * 60 * 1000;
    await user.save({ session });

    // Don't wait for email to send before committing, or handle failure differently. 
    // Usually better to commit DB change then send email asynchronously.
    await session.commitTransaction();
    session.endSession();

    const options = { email: user.email, subject: 'OTP for resetting your password', message: `Your requested OTP for resetting your password is: ${user.otp}`, html: `<h1>Your requested OTP for resetting your password is: ${user.otp}</h1>` }
    sendEmail(options).catch(err => console.error("Failed to send OTP", err));

    return res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
      session.endSession();
    }
    res.status(500).json({ message: 'Server error' });
  }
})
router.put('/reset-password/:userId', protect, admin, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { newPassword, otp, email } = req.body;
    const user = await User.findOne({ email }).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.otp !== otp) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    if (user.otpExpiry < Date.now()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'OTP expired' });
    }
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.otp = null;
    user.otpExpiry = null;
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/users
// @desc    Get all users (Admin only)
router.get('/users', protect, admin, async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/peers
// @desc    Get all non-admin users — accessible to any logged-in user (for split participant list)
router.get('/peers', protect, async (req, res) => {
  try {
    const users = await User.find({ role: 'client' }).select('-password -otp -otpExpiry');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/auth/profile
// @desc    Update current user profile (username)
router.patch('/profile', protect, async (req, res) => {
  try {
    const session = await mongoose.startSession()
    session.startTransaction();
    const user = await User.findById(req.user.id).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.body.username !== undefined) {
      // Check if username is taken by someone else
      if (req.body.username !== user.username) {
        const existing = await User.findOne({ username: req.body.username }).session(session);
        if (existing) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ message: 'Username is already taken' });
        }
      }
      user.username = req.body.username;
    }

    await user.save();
    await session.commitTransaction()
    session.endSession()
    res.json({ _id: user._id, username: user.username, role: user.role });
  } catch (error) {
    console.log(error)
    await session.abortTransaction();
    session.endSession();

    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/auth/profile
// @desc    Update current user profile (username)
router.patch('/profile', protect, async (req, res) => {
  try {
    const session = await mongoose.startSession()
    session.startTransaction();
    const user = await User.findById(req.user.id).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.body.username !== undefined) {
      // Check if username is taken by someone else
      if (req.body.username !== user.username) {
        const existing = await User.findOne({ username: req.body.username }).session(session);
        if (existing) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ message: 'Username is already taken' });
        }
      }
      user.username = req.body.username;
    }

    await user.save();
    await session.commitTransaction()
    session.endSession()
    return res.json({ _id: user._id, username: user.username, role: user.role });
  } catch (error) {
    await session.abortTransaction();
    session.endSession()
    return res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change current user password
router.post('/change-password', protect, async (req, res) => {
  try {
    const session = await mongoose.startSession()
    await session.startTransaction()
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      await session.abortTransaction()
      session.endSession()
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    await session.commitTransaction();
    session.endSession();
    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

