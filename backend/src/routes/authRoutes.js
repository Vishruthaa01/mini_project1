const express = require('express');
const { signup, login, getUserProfile, updateUserProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);

module.exports = router;