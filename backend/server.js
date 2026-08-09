const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const User = require('./models/User');

dotenv.config();

const app = express();

// Security & Optimization Middleware
app.use(helmet()); // Sets security headers
app.use(compression()); // Gzip compress responses

// Configure CORS for production
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://10.183.144.125:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      (origin && origin.endsWith('.onrender.com')) // Automatically allow Render deployments
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Rate Limiting (Prevent abuse on auth routes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  message: 'Too many auth requests from this IP, please try again after 15 minutes'
});
app.use('/api/auth', authLimiter);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/settlements', require('./routes/settlementRoutes'));
app.use('/api/expense-requests', require('./routes/expenseRequestRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.get('/api/health', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const status = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return res.status(200).json({
    message: 'server is health',
    database: status[dbState] || 'unknown',
    uptime: process.uptime()
  });
});

// Database Connection
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/expense-tracker';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');

    // Auto-create default admin if no users exist
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, salt);
      await User.create({
        username: 'admin',
        email: process.env.EMAIL_ADDRESS,
        password: hashedPassword,
        role: 'admin'
      });
      console.log('Default admin user created. Username: admin, Password: admin123');
    }

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Graceful Shutdown
    const shutdown = () => {
      console.log('SIGTERM/SIGINT received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false).then(() => {
          console.log('MongoDB connection closed');
          process.exit(0);
        });
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });