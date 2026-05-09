const { verifyAccess } = require('../utils/jwt');
const { fail } = require('../utils/response');

module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
  try {
    req.user = verifyAccess(header.slice(7));
    next();
  } catch (err) {
    // TOKEN_EXPIRED tells the frontend to attempt a silent refresh;
    // INVALID_TOKEN means the token is tampered or malformed — force re-login
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    fail(res, 'Unauthorized', code, 401);
  }
};
