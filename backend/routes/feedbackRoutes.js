const router = require('express').Router();
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const c = require('../controllers/feedbackController');

router.post('/', verifyToken, c.submit);
router.get('/', verifyToken, requireRole('admin'), c.list);
router.put('/:id/status', verifyToken, requireRole('admin'), c.updateStatus);

module.exports = router;
