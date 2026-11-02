/**
 * Required catch-all so nested routes like /api/transactions/authorize
 * hit the same in-memory ledger as /api.
 */
const handler = require("./index.js");

module.exports = (req, res) => {
  const parts = req.query && req.query.path;
  const list = Array.isArray(parts) ? parts : parts ? [parts] : [];
  const suffix = list.filter(Boolean).join("/");
  if (suffix) req.url = `/api/${suffix}`;
  return handler(req, res);
};
