const path = require("path");
const express = require("express");
const handler = require("../api/index.js");

const app = express();
app.use(express.json());

// Every API route shares the in-process ledger in api/index.js.
app.use("/api", (req, res) => {
  const original = req.url || "/";
  req.url = "/api" + (original.startsWith("/") ? original : `/${original}`);
  return handler(req, res);
});

app.use(express.static(path.join(__dirname, "../public")));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Nexus Agentic sandbox http://localhost:${port}`);
});
