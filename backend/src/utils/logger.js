const write = (level, msg, meta) =>
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
    JSON.stringify({ level, msg, ...meta, ts: new Date().toISOString() })
  );

const log = {
  info: (msg, meta = {}) => write('info', msg, meta),
  warn: (msg, meta = {}) => write('warn', msg, meta),
  error: (msg, meta = {}) => write('error', msg, meta),
  authFail: (email, ip) => write('warn', 'auth_failure', { email, ip }),
  rateLimitHit: (ip, email) => write('warn', 'rate_limit_exceeded', { ip, email: email ?? null }),
};

module.exports = log;
