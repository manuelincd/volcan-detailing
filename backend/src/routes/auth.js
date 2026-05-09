const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const validate = require('../middlewares/validate');
const authSchema = require('../schemas/authSchema');
const authController = require('../controllers/authController');
const { LOGIN_RATE_LIMIT } = require('../config/constants');
const { fail } = require('../utils/response');
const log = require('../utils/logger');

const loginLimiter = rateLimit({
  windowMs: LOGIN_RATE_LIMIT.windowMs,
  max: LOGIN_RATE_LIMIT.max,
  standardHeaders: true,   // returns RateLimit-* headers so clients know when to retry
  legacyHeaders: false,
  handler: (req, res) => {
    log.rateLimitHit(req.ip, req.body?.email);
    fail(res, 'Too many login attempts. Try again in 15 minutes.', 'RATE_LIMIT_EXCEEDED', 429);
  },
});

router.post('/register', validate(authSchema.register), authController.register);
router.post('/login', loginLimiter, validate(authSchema.login), authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);

module.exports = router;
