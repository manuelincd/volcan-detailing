const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

const signAccess = (payload) =>
  jwt.sign(payload, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: env.JWT_ACCESS_EXPIRES });

const signRefresh = (payload) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, { algorithm: 'HS256', expiresIn: env.JWT_REFRESH_EXPIRES });

// Short-lived token (5 min) used as a MFA challenge — carries mfaRequired:true so it
// cannot be used as a regular access token even if intercepted
const signTemp = (payload) =>
  jwt.sign(payload, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });

const verifyAccess = (token) => jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });

const verifyRefresh = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });

const verifyTemp = (token) => jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });

module.exports = { signAccess, signRefresh, signTemp, verifyAccess, verifyRefresh, verifyTemp };
