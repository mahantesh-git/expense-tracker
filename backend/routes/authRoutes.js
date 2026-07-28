const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');
const {sendEmail}=require('../utils/sendEmail')

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
  try {
    const { email, username } = req.body;
    const userExists = await User.findOne({ $or: [{ username: username }, { email: email }] });
    let Username;
    if(!username){
      Username=email.trim().split('@')[0].toLowerCase();
    } else {
      Username=username;
    }

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    // User requested password to be the same as username
    const hashedPassword = await bcrypt.hash(Username, salt);

    const user = await User.create({
      email,
      username:Username,
      password: hashedPassword,
      role: 'client',
    });
  
    if (user) {
      res.status(201).json({
        _id: user._id,
        username: user.username,
        role: user.role,
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/reset-password/:userId
// @desc    Reset a user's password (Admin only)

router.post('/reset-password-otp/:email' , protect , admin , async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.otpExpiry > Date.now()) {
      return res.status(400).json({ success: false, message: `retry after few miniutes`});
    }
    const otp= Math.floor(100000 + Math.random() * 900000);
    console.log(otp)
    user.otp=otp;
    user.otpExpiry=Date.now() + 10*60*1000;
    await user.save();
    const options={email:user.email,subject:'OTP for resetting your password',message:`Your requested OTP for resetting your password is: ${user.otp}`,html:`<h1>Your requested OTP for resetting your password is: ${user.otp}</h1>`}
    await sendEmail(options)
    return res.json({ message: 'OTP sent successfully' });
  } catch (error) { 
    res.status(500).json({ message: 'Server error' });
  }
})
router.put('/reset-password/:userId', protect, admin, async (req, res) => {
  try {
    const { newPassword,otp,email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    if (user.otpExpiry < Date.now()) {
      return res.status(400).json({ message: 'OTP expired' });
    }
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
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

module.exports = router;

