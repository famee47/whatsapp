const router = require('express').Router();
const s = require('../controllers/statusController');
const { protect } = require('../middleware/authMiddleware');
router.post('/', protect, s.createStatus);
router.get('/', protect, s.getStatuses);
router.put('/:id/view', protect, s.viewStatus);
router.delete('/:id', protect, s.deleteStatus);
module.exports = router;
