const router = require('express').Router();
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const c = require('../controllers/messageController');

router.post('/', verifyToken, requireRole('student'), c.sendMessage);
router.get('/sent', verifyToken, requireRole('student'), c.getSentMessages);
router.get('/inbox', verifyToken, requireRole('faculty'), c.getMyMessages);
router.put('/:messageId/read', verifyToken, requireRole('faculty'), c.markAsRead);
router.put('/:messageId/reply', verifyToken, requireRole('faculty'), c.replyToMessage);

module.exports = router;
