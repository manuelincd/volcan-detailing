const { fail } = require('../utils/response');

const allow = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) return fail(res, 'Forbidden', 'FORBIDDEN', 403);
  next();
};

module.exports = { allow };
