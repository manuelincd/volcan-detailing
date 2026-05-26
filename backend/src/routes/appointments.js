const router = require('express').Router();
const auth = require('../middlewares/auth');
const { allow } = require('../middlewares/roleGuard');
const validate = require('../middlewares/validate');
const schema = require('../schemas/appointmentSchema');
const ctrl = require('../controllers/appointmentController');
const { ROLES } = require('../config/constants');

router.use(auth);
router.get('/', ctrl.list);
router.post('/', allow(ROLES.CLIENT), validate(schema.create), ctrl.create);
router.get('/:id', ctrl.get);
router.patch('/:id/assign', allow(ROLES.ADMIN), validate(schema.assign), ctrl.assign);
router.patch('/:id', validate(schema.updateStatus), ctrl.update);
router.delete('/:id', allow(ROLES.ADMIN), ctrl.remove);

module.exports = router;
