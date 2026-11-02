/**
 * Vercel catch-all. Each request carries its own step number, so a cold
 * start does not need the previous function's memory to continue the chat.
 * Wallet debit still happens inside the final step, in this process.
 */
const handler = require("./index.js");

module.exports = (req, res) => {
  const parts = req.query && req.query.path;
  const list = Array.isArray(parts) ? parts : parts ? [parts] : [];
  const suffix = list.filter(Boolean).join("/");
  req.url = suffix ? `/api/${suffix}` : "/api";
  return handler(req, res);
};
