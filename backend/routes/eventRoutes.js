const router = require('express').Router();
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const c = require('../controllers/eventController');

router.get('/', verifyToken, c.listEvents);
router.post('/', verifyToken, requireRole('admin', 'faculty'), c.createEvent);
router.delete('/:eventId', verifyToken, requireRole('admin', 'faculty'), c.deleteEvent);
router.post('/:eventId/register', verifyToken, c.register);
router.delete('/:eventId/register', verifyToken, c.unregister);

module.exports = router;
