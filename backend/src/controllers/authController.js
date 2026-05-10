const prisma = require('../config/db');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { signAccess, signRefresh, signTemp, verifyTemp } = require('../utils/jwt');
const { ok, fail } = require('../utils/response');
const log = require('../utils/logger');
const { ROLES } = require('../config/constants');

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const DUMMY_HASH = '$2b$12$invalidhashpaddingtomatchbcrypttime';

const cookieOpts = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth',
  maxAge: REFRESH_MAX_AGE,
};

const clearOpts = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth',
};

const userPublic = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  mfaEnabled: u.mfaEnabled,
});

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
    if (err.code === 'P2002') return fail(res, 'Registration failed', 'REGISTRATION_FAILED');
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    const hash = user?.passwordHash ?? DUMMY_HASH;
    const valid = await bcrypt.compare(password, hash);

    if (!user || !user.isActive || !valid) {
      log.authFail(email, req.ip);
      return fail(res, 'Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    if (user.mfaEnabled) {
      const tempToken = signTemp({ sub: user.id, role: user.role, mfaRequired: true });
      return ok(res, { mfaRequired: true, tempToken });
    }

    const payload = { sub: user.id, role: user.role };
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);

    res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts);
    ok(res, { accessToken, user: userPublic(user) });
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

    const { verifyRefresh } = require('../utils/jwt');
    const payload = verifyRefresh(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true, mfaEnabled: true },
    });
    if (!user || !user.isActive) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const accessToken = signAccess({ sub: user.id, role: user.role });
    ok(res, { accessToken, user: userPublic(user) });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return fail(res, 'Unauthorized', 'INVALID_TOKEN', 401);
    }
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, passwordHash: true },
    });

    const valid = await bcrypt.compare(currentPassword, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      return fail(res, 'Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
    ok(res, { message: 'Password updated' });
  } catch (err) { next(err); }
};

// ─── MFA ──────────────────────────────────────────────────────────────────────

exports.mfaSetup = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { email: true, mfaEnabled: true },
    });

    if (user.mfaEnabled) {
      return fail(res, 'MFA already enabled', 'MFA_ALREADY_ENABLED', 400);
    }

    const secret = speakeasy.generateSecret({
      name: `Volcán Detailing:${user.email}`,
      issuer: 'Volcán Detailing',
      length: 20,
    });

    await prisma.user.update({
      where: { id: req.user.sub },
      data: { mfaSecret: secret.base32 },
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    ok(res, { secret: secret.base32, qrCodeUrl });
  } catch (err) { next(err); }
};

exports.mfaVerifySetup = async (req, res, next) => {
  try {
    const { token } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { mfaSecret: true, mfaEnabled: true },
    });

    if (!user?.mfaSecret) {
      return fail(res, 'MFA setup not initiated', 'MFA_NOT_SETUP', 400);
    }
    if (user.mfaEnabled) {
      return fail(res, 'MFA already enabled', 'MFA_ALREADY_ENABLED', 400);
    }

    const valid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) return fail(res, 'Invalid code', 'INVALID_MFA_TOKEN', 401);

    await prisma.user.update({
      where: { id: req.user.sub },
      data: { mfaEnabled: true },
    });

    ok(res, { message: 'MFA enabled' });
  } catch (err) { next(err); }
};

exports.mfaDisable = async (req, res, next) => {
  try {
    const { password } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, passwordHash: true },
    });

    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      return fail(res, 'Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    ok(res, { message: 'MFA disabled' });
  } catch (err) { next(err); }
};

exports.mfaValidate = async (req, res, next) => {
  try {
    const { tempToken, token } = req.body;

    let payload;
    try {
      payload = verifyTemp(tempToken);
    } catch {
      return fail(res, 'Invalid or expired token', 'INVALID_TOKEN', 401);
    }

    if (!payload.mfaRequired) {
      return fail(res, 'Invalid token', 'INVALID_TOKEN', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true, mfaSecret: true, mfaEnabled: true },
    });

    if (!user || !user.isActive || !user.mfaEnabled || !user.mfaSecret) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const valid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) return fail(res, 'Invalid code', 'INVALID_MFA_TOKEN', 401);

    const jwtPayload = { sub: user.id, role: user.role };
    const accessToken = signAccess(jwtPayload);
    const refreshToken = signRefresh(jwtPayload);

    res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts);
    ok(res, { accessToken, user: userPublic(user) });
  } catch (err) { next(err); }
};
