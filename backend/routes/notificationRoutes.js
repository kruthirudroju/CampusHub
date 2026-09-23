const router = require('express').Router();
const { verifyToken } = require('../middleware/authMiddleware');
const c = require('../controllers/notificationController');

router.get('/', verifyToken, c.getNotifications);
router.put('/checked', verifyToken, c.markChecked);

module.exports = router;
