const router = require('express').Router();
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const c = require('../controllers/clubController');

router.get('/', verifyToken, c.getAllClubs);
router.delete('/posts/:postId', verifyToken, requireRole('admin', 'faculty'), c.deletePost);
router.get('/:clubId', verifyToken, c.getClubById);
router.post('/:clubId/join', verifyToken, c.joinClub);
router.delete('/:clubId/join', verifyToken, c.leaveClub);
router.put('/:clubId/coordinator', verifyToken, requireRole('admin'), c.setCoordinator);
router.put('/:clubId/description', verifyToken, requireRole('admin', 'faculty'), c.updateClubDescription);
router.post('/:clubId/posts', verifyToken, requireRole('admin', 'faculty'), c.createPost);

module.exports = router;
