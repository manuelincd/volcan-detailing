const prisma = require('../config/db');

async function addEntry(type, data) {
  try {
    await prisma.auditLog.create({ data: { type, data } });
  } catch { /* DB failure must never crash the calling request */ }
}

async function getEntries(limit = 100) {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  // Map createdAt → ts so the existing frontend shape stays unchanged
  return rows.map((r) => ({ id: r.id, type: r.type, data: r.data, ts: r.createdAt }));
}

module.exports = { addEntry, getEntries };
