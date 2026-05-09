const router = require('express').Router();
const ctrl = require('../controllers/availabilityController');

router.get('/', ctrl.getAvailability);

module.exports = router;
