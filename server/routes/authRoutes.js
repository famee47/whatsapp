// authRoutes.js
const router = require('express').Router();
const auth = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');
const lim = rateLimit({ windowMs:15*60*1000, max:20, message:{ message:'Too many attempts. Try again in 15 minutes.' } });
router.post('/register', lim, auth.register);
router.post('/login', lim, auth.login);
router.get('/me', protect, auth.getMe);
router.post('/logout', protect, auth.logout);
router.put('/profile', protect, auth.updateProfile);
router.put('/change-password', protect, auth.changePassword);
router.delete('/account', protect, auth.deleteAccount);
module.exports = router;
