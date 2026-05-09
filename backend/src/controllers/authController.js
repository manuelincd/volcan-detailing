const prisma = require('../config/db');
const bcrypt = require('bcrypt');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { ok, fail } = require('../utils/response');
const log = require('../utils/logger');
const { ROLES } = require('../config/constants');

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

const cookieOpts = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth',  // cookie only sent to auth endpoints, not every API request
  maxAge: REFRESH_MAX_AGE,
};

// Matches clearCookie — path must be identical or the browser won't delete it
const clearOpts = { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api/auth' };

exports.register = async (req, res, next) => {
  try {
    const { email, password, name, phone } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, phone, role: ROLES.CLIENT },
      select: { id: true, email: true, name: true, role: true },
    });
    ok(res, user, 201);
  } catch (err) {
    // P2002 = unique constraint violation (email already exists)
    // Return the same generic message to avoid leaking whether an email is registered
    if (err.code === 'P2002') return fail(res, 'Registration failed', 'REGISTRATION_FAILED');
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    // Evaluate bcrypt even when user is not found to prevent timing-based user enumeration
    const hash = user?.passwordHash ?? '$2b$12$invalidhashpaddingtomatchbcrypttime';
    const valid = await bcrypt.compare(password, hash);

    if (!user || !user.isActive || !valid) {
      log.authFail(email, req.ip);
      return fail(res, 'Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    const payload = { sub: user.id, role: user.role };
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);

    res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts);
    ok(res, {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) { next(err); }
};

exports.logout = (req, res) => {
  res.clearCookie(REFRESH_COOKIE, clearOpts);
  ok(res, { message: 'Logged out' });
};

exports.refresh = async (req, res, next) => {
  try {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const payload = verifyRefresh(token);

    // Verify the user still exists and is active before issuing a new access token
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const accessToken = signAccess({ sub: user.id, role: user.role });
    ok(res, {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return fail(res, 'Unauthorized', 'INVALID_TOKEN', 401);
    }
    next(err);
  }
};
