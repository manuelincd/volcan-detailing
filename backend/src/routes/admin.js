const router = require('express').Router();
const auth = require('../middlewares/auth');
const { allow } = require('../middlewares/roleGuard');
const { ROLES } = require('../config/constants');
const { getEntries } = require('../utils/auditLog');
const { ok } = require('../utils/response');
const serviceCtrl = require('../controllers/serviceController');

router.use(auth, allow(ROLES.ADMIN));

router.get('/audit-log', async (_req, res, next) => {
  try {
    ok(res, await getEntries(100));
  } catch (err) { next(err); }
});

router.get('/services', serviceCtrl.listAll);

module.exports = router;
