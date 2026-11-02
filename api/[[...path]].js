const handler = require("../lib/engine.js");

module.exports = (req, res) => {
  const parts = req.query && (req.query.path || req.query.__path);
  const list = Array.isArray(parts) ? parts : parts ? [parts] : [];
  const suffix = list.filter(Boolean).join("/");
  if (suffix && !String(suffix).startsWith("/api")) req.url = `/api/${suffix}`;
  else if (suffix) req.url = suffix;
  return handler(req, res);
};
