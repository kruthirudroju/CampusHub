const router = require('express').Router();
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const c = require('../controllers/maintenanceController');

router.post('/', verifyToken, c.createRequest);
router.get('/mine', verifyToken, c.getMyRequests);
router.get('/', verifyToken, requireRole('admin'), c.getAllRequests);
router.put('/:requestId/status', verifyToken, requireRole('admin'), c.updateRequestStatus);

module.exports = router;
