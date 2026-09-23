const router = require('express').Router();
const { verifyToken } = require('../middleware/authMiddleware');
const c = require('../controllers/lostFoundController');

router.get('/', verifyToken, c.listItems);
router.post('/', verifyToken, c.createItem);
router.put('/:itemId/status', verifyToken, c.updateStatus);

module.exports = router;
