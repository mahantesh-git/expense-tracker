const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── In-memory user cache (60 s TTL) ─────────────────────────────
// Eliminates one DB round-trip on every protected request.
const userCache = new Map(); // id -> { user, expiresAt }
const USER_CACHE_TTL = 60 * 1000; // 60 seconds

const getCachedUser = (id) => {
  const entry = userCache.get(id);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    userCache.delete(id);
    return null;
  }
  return entry.user;
};

const setCachedUser = (id, user) => {
  userCache.set(id, { user, expiresAt: Date.now() + USER_CACHE_TTL });
};

// Call this when an admin toggles a user's active status,
// so the next request re-reads the updated record from the DB.
const invalidateUserCache = (id) => userCache.delete(String(id));

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

      const id = String(decoded.id);
      let user = getCachedUser(id);

      if (!user) {
        // .lean() returns a plain JS object — no Mongoose hydration cost
        user = await User.findById(id).select('-password').lean();
        if (user) setCachedUser(id, user);
      }

      if (!user) {
        return res.status(401).json({ message: 'User no longer exists' });
      }
      if (user.isActive === false) {
        return res.status(403).json({ message: 'Your account has been deactivated' });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an admin' });
  }
};

module.exports = { protect, admin, invalidateUserCache };
