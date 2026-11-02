const fs = require("fs");
const path = require("path");
const express = require("express");

const envFile = path.join(__dirname, "../.env");
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, "utf8").split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index < 1) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  });
}

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
