const prisma = require('../config/db');
const bcrypt = require('bcrypt');
const { ok, fail } = require('../utils/response');
const { ROLES } = require('../config/constants');

// Never return passwordHash, updatedAt, or any other internal fields
const SELECT_SAFE = {
  id: true, email: true, name: true, phone: true,
  role: true, isActive: true, createdAt: true,
};

function parseId(param) {
  const id = parseInt(param, 10);
  return Number.isNaN(id) ? null : id;
}

exports.list = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select:  SELECT_SAFE,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    ok(res, users);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    // Whitelist: only these four fields are written; role is hardcoded to employee
    const { email, password, name, phone } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data:   { email, passwordHash, name, phone, role: ROLES.EMPLOYEE },
      select: SELECT_SAFE,
    });
    ok(res, user, 201);
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 'Email is already registered', 'DUPLICATE_EMAIL', 409);
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return fail(res, 'Invalid id', 'INVALID_ID', 400);

    // Prevent an admin from deactivating their own account
    if (req.body.isActive === false && id === req.user.sub)
      return fail(res, 'Admins cannot deactivate their own account', 'SELF_DEACTIVATION', 403);

    // Build the data object from only the fields present in the validated body —
    // avoids sending undefined to Prisma and makes the whitelist explicit
    const { name, phone, isActive } = req.body;
    const data = {};
    if (name     !== undefined) data.name     = name;
    if (phone    !== undefined) data.phone    = phone;
    if (isActive !== undefined) data.isActive = isActive;

    const user = await prisma.user.update({
      where:  { id },
      data,
      select: SELECT_SAFE,
    });
    ok(res, user);
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 'User not found', 'NOT_FOUND', 404);
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return fail(res, 'Invalid id', 'INVALID_ID', 400);

    // Prevent an admin from soft-deleting their own account
    if (id === req.user.sub)
      return fail(res, 'Admins cannot deactivate their own account', 'SELF_DEACTIVATION', 403);

    const user = await prisma.user.update({
      where:  { id },
      data:   { isActive: false },
      select: SELECT_SAFE,
    });
    ok(res, user);
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 'User not found', 'NOT_FOUND', 404);
    next(err);
  }
};
