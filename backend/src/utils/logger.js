const auditLog = require('./auditLog');

const write = (level, msg, meta) =>
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
    JSON.stringify({ level, msg, ...meta, ts: new Date().toISOString() })
  );

const log = {
  info: (msg, meta = {}) => write('info', msg, meta),
  warn: (msg, meta = {}) => write('warn', msg, meta),
  error: (msg, meta = {}) => write('error', msg, meta),
  authFail: (email, ip) => {
    write('warn', 'auth_failure', { email, ip });
    auditLog.addEntry('auth_failure', { email, ip }).catch(() => {});
  },
  rateLimitHit: (ip, email) => {
    write('warn', 'rate_limit_exceeded', { ip, email: email ?? null });
    auditLog.addEntry('rate_limit', { ip, email: email ?? null }).catch(() => {});
  },
  appointmentStatusChange: (appointmentId, fromStatus, toStatus, changedBy, role) => {
    write('info', 'appointment_status_change', {
      appointmentId, fromStatus, toStatus, changedByUserId: changedBy, role,
    });
    auditLog.addEntry('status_change', {
      appointmentId, fromStatus, toStatus, changedByUserId: changedBy, role,
    }).catch(() => {});
  },
};

module.exports = log;
