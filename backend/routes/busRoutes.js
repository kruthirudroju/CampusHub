const router = require('express').Router();
const { verifyToken } = require('../middleware/authMiddleware');
const c = require('../controllers/busController');

router.get('/', verifyToken, c.getAllBuses);
router.get('/:busId', verifyToken, c.getBusById);

module.exports = router;
