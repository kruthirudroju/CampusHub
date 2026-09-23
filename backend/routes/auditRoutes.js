const router = require('express').Router();
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const c = require('../controllers/auditController');

router.get('/', verifyToken, requireRole('admin'), c.list);
router.get('/export.xlsx', verifyToken, requireRole('admin'), c.exportExcel);
router.get('/analytics', verifyToken, requireRole('admin'), c.analytics);

module.exports = router;
