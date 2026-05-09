const router = require('express').Router();
const auth = require('../middlewares/auth');
const { allow } = require('../middlewares/roleGuard');
const validate = require('../middlewares/validate');
const schema = require('../schemas/serviceSchema');
const ctrl = require('../controllers/serviceController');
const { ROLES } = require('../config/constants');

// Public — no auth required
router.get('/', ctrl.list);

// Admin only
router.post('/',    auth, allow(ROLES.ADMIN), validate(schema.create), ctrl.create);
router.put('/:id',  auth, allow(ROLES.ADMIN), validate(schema.update), ctrl.update);
router.delete('/:id', auth, allow(ROLES.ADMIN), ctrl.remove);

module.exports = router;
