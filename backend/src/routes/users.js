const router = require('express').Router();
const auth = require('../middlewares/auth');
const { allow } = require('../middlewares/roleGuard');
const validate = require('../middlewares/validate');
const schema = require('../schemas/userSchema');
const ctrl = require('../controllers/userController');
const { ROLES } = require('../config/constants');

router.use(auth, allow(ROLES.ADMIN));
router.get('/', ctrl.list);
router.post('/', validate(schema.createEmployee), ctrl.create);
router.put('/:id', validate(schema.update), ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
