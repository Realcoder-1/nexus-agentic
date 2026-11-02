# Nexus Agentic

Programmatic wallets for autonomous AI agents.

This repository is the live sandbox: a landing page plus a real authorization API. Funds only clear when the merchant is whitelisted, the spend is under the agent ceiling, and the execution log contains `SUCCESS: Task completed`.

## Run locally

```bash
node scripts/local-server.js
```

Open http://localhost:3000

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/catalog` | Seeded tenants and current wallet balances |
| POST | `/api/wallets/create` | Provision a sandboxed agent wallet |
| POST | `/api/dialogue/start` | Open the scripted Acme / Global Logistics exchange |
| POST | `/api/dialogue/next` | Advance one prewritten message; the last step settles |
| POST | `/api/transactions/authorize` | Evaluate and settle a machine transaction |
| POST | `/api/demo/reset` | Restore sandbox wallets |

Sandbox balances reset on serverless cold start.
