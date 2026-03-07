const router = require('express').Router();
const c = require('../controllers/conversationController');
const { protect } = require('../middleware/authMiddleware');
router.post('/', protect, c.createOrGet);
router.get('/', protect, c.getAll);
router.get('/:userId', protect, c.getAll);
module.exports = router;
