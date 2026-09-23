const router = require('express').Router();
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const c = require('../controllers/facultyController');

router.get('/', verifyToken, c.getAllFacultyStatus);
router.put('/status', verifyToken, requireRole('faculty'), c.updateOwnStatus);
router.get('/:facultyId', verifyToken, c.getFacultyStatusById);

module.exports = router;
