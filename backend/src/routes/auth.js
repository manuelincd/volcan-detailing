const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const auth = require('../middlewares/auth');
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
router.post('/change-password', auth, validate(authSchema.changePassword), authController.changePassword);

// MFA — setup and disable require a valid session; validate uses tempToken instead
router.post('/mfa/setup', auth, authController.mfaSetup);
router.post('/mfa/verify-setup', auth, validate(authSchema.mfaVerifySetup), authController.mfaVerifySetup);
router.post('/mfa/disable', auth, validate(authSchema.mfaDisable), authController.mfaDisable);
router.post('/mfa/validate', validate(authSchema.mfaValidate), authController.mfaValidate);

module.exports = router;
