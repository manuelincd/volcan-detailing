const prisma = require('../config/db');
const { ok, fail } = require('../utils/response');
const { stripHtml } = require('../utils/sanitize');

function parseId(param) {
  const id = parseInt(param, 10);
  return Number.isNaN(id) ? null : id;
}

exports.list = async (req, res, next) => {
  try {
    const services = await prisma.service.findMany({
      where:   { isActive: true },
      orderBy: { name: 'asc' },
    });
    ok(res, services);
  } catch (err) { next(err); }
};

exports.listAll = async (req, res, next) => {
  try {
    const services = await prisma.service.findMany({ orderBy: { name: 'asc' } });
    ok(res, services);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    // Whitelist fields explicitly — isActive is always true on creation
    const { name, description, durationMinutes, prices } = req.body;
    // Re-construct prices from known keys only; Joi already validated, but this
    // prevents any future middleware from injecting extra keys into the JSON column.
    const safePrice = { sedan: prices.sedan, suv: prices.suv, van: prices.van };
    // Defense-in-depth: strip any residual HTML even though Joi already rejected it.
    const safeDesc = description != null ? stripHtml(description) : undefined;
    const service = await prisma.service.create({
      data: { name, description: safeDesc, durationMinutes, prices: safePrice, isActive: true },
    });
    ok(res, service, 201);
  } catch (err) {
    // P2002 = unique constraint on name
    if (err.code === 'P2002') return fail(res, 'A service with that name already exists', 'DUPLICATE_NAME', 409);
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return fail(res, 'Invalid id', 'INVALID_ID', 400);

    // Whitelist fields — prevents mass assignment from unexpected body keys
    const { name, description, durationMinutes, prices, isActive } = req.body;
    const safePrice = { sedan: prices.sedan, suv: prices.suv, van: prices.van };
    const safeDesc = description != null ? stripHtml(description) : undefined;

    const service = await prisma.service.update({
      where: { id },
      data:  { name, description: safeDesc, durationMinutes, prices: safePrice, isActive },
    });
    ok(res, service);
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 'Service not found', 'NOT_FOUND', 404);
    if (err.code === 'P2002') return fail(res, 'A service with that name already exists', 'DUPLICATE_NAME', 409);
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return fail(res, 'Invalid id', 'INVALID_ID', 400);

    const service = await prisma.service.update({
      where: { id },
      data:  { isActive: false },
    });
    ok(res, service);
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 'Service not found', 'NOT_FOUND', 404);
    next(err);
  }
};
