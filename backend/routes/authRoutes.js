const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const c = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// Brute-force protection on the credential endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please wait a few minutes.' }
});

router.post('/signup', authLimiter, c.signup);
router.post('/login', authLimiter, c.login);
router.get('/me', verifyToken, c.me);
router.put('/password', verifyToken, c.changePassword);

module.exports = router;
