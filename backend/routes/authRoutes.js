const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const c = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many attempts. Please wait a few minutes.' }
});

// A tighter limiter specifically for the reset-request endpoint, since it
// triggers an outgoing email each time and must resist being used to spam.
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many reset requests. Please wait a few minutes.' }
});

router.post('/signup', authLimiter, c.signup);
router.post('/login', authLimiter, c.login);
router.get('/me', verifyToken, c.me);
router.put('/password', verifyToken, c.changePassword);
router.post('/forgot-password', resetLimiter, c.forgotPassword);
router.post('/reset-password', authLimiter, c.resetPassword);

module.exports = router;
