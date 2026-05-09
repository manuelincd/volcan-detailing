const ok = (res, data, status = 200) => res.status(status).json({ error: false, data });

const fail = (res, message, code, status = 400) =>
  res.status(status).json({ error: true, message, code });

module.exports = { ok, fail };
