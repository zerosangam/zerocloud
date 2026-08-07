const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { createRateLimiter } = require('../middleware/rateLimit');

// 10 attempts per 5 minutes per IP — generous for real users, painful for brute force.
const authLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: 10,
    message: 'Too many attempts. Please wait a few minutes and try again.',
});

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);

module.exports = router;
