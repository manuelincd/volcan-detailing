const log = require('../utils/logger');

module.exports = (err, req, res, next) => {
  log.error('unhandled_error', { message: err.message });
  res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
};
