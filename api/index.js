/**
 * Nexus Agentic — sandboxed evaluation engine
 *
 * Single serverless entry so wallet state is shared across demo routes.
 * Cold starts reseed the two corporate tenants (expected for this sandbox).
 *
 * Routes:
 *   GET  /api/health
 *   GET  /api/catalog
 *   POST /api/wallets/create
 *   POST /api/transactions/authorize
 *   POST /api/authorize
 */

const TASK_SUCCESS_PHRASE = "SUCCESS: Task completed";

function seedCatalog() {
  return {
    acme_ai: {
      id: "acme_ai",
      name: "Acme AI Corp",
      type: "Venture-funded AI lab",
      departments: {
        engineering: {
          key: "engineering",
          label: "DevOps Automation",
          agentId: "acme_devops_01",
          balanceUSD: 8500,
          spendingLimitUSD: 50,
          allowedMerchants: ["github.com", "vercel.com", "openai.com", "flexport.com"],
          successLog:
            "[INFO] Auditing container deployment pipelines.\n[STATUS] Production instance cleared.\n[STATUS] SUCCESS: Task completed. Script compilation verified.",
          failLog:
            "[INFO] Querying server cluster statuses.\n[ERROR] Authentication key missing from environment.\n[STATUS] FAILED: Target deployment pipeline terminated.",
        },
        marketing: {
          key: "marketing",
          label: "Growth Automation",
          agentId: "acme_growth_03",
          balanceUSD: 24000,
          spendingLimitUSD: 300,
          allowedMerchants: ["google.com", "meta.com"],
          successLog:
            "[INFO] Parsing performance marketing conversion matrices.\n[PROCESS] Campaign configuration update processed.\n[STATUS] SUCCESS: Task completed. Spend constraints checked out.",
          failLog:
            "[INFO] Attempting data asset compilation run.\n[CRITICAL] Metric pipeline timeout exception thrown.\n[STATUS] FAILED: Execution loop aborted.",
        },
      },
    },
    global_logistics: {
      id: "global_logistics",
      name: "Global Logistics Ltd",
      type: "High-volume supply chain",
      departments: {
        shipping: {
          key: "shipping",
          label: "Freight Customs",
          agentId: "log_customs_04",
          balanceUSD: 145000,
          spendingLimitUSD: 5000,
          allowedMerchants: ["flexport.com", "fedex.com"],
          successLog:
            "[INFO] Reviewing customs tracking manifest schemas.\n[STATUS] Verification token validated against registry.\n[STATUS] SUCCESS: Task completed. Customs tracking clearance verified.",
          failLog:
            "[INFO] Polling port manifest verification loops.\n[ERROR] Inbound ledger record mismatch identified.\n[STATUS] FAILED: Security authentication check failed.",
        },
        dispatch: {
          key: "dispatch",
          label: "Last-Mile Dispatch",
          agentId: "log_routing_09",
          balanceUSD: 1800,
          spendingLimitUSD: 120,
          allowedMerchants: ["mapbox.com", "twilio.com"],
          successLog:
            "[INFO] Fetching spatial cluster coordinates for active fleets.\n[PROCESS] Dynamic routing configuration updated.\n[STATUS] SUCCESS: Task completed. Geo-fencing profiles locked.",
          failLog:
            "[INFO] Triggering fleet broadcast notification strings.\n[CRITICAL] Network cell handoff timed out.\n[STATUS] FAILED: API pipeline unavailable.",
        },
      },
    },
  };
}

/** In-process ledger. Demo only — resets on serverless cold start. */
const wallets = new Map();
const ledger = [];
const sessions = new Map();
const invoices = [];

/**
 * Four department wallets on the shared Nexus rail.
 * Each payer talks to an agent at the other company. Lines are static.
 */
const SCENES = {
  acme_devops_01: scene({
    agentId: "acme_devops_01",
    department: "DevOps Automation",
    companyId: "acme_ai",
    company: "Acme AI Corp",
    counterparty: "log_customs_04",
    counterpartyCompany: "Global Logistics Ltd",
    liveLine: "Clearing manifest M-1042 with customs",
    invoice: { id: "inv_M1042", merchant: "flexport.com", amountUSD: 42, memo: "customs clearance manifest M-1042" },
    ceiling: "50.00",
    lines: [
      ["payer", "Intent [FREIGHT_MANIFEST_CLEARANCE]. Clear manifest M-1042 and bill flexport.com. This Nexus wallet can spend up to $50.00."],
      ["counterparty", "Manifest M-1042 is ready to clear through flexport.com. Ask and I will issue the invoice on Nexus."],
      ["payer", "Issue the invoice."],
      ["counterparty", "INVOICE inv_M1042 | merchant: flexport.com | amount: 42.00 | memo: customs clearance manifest M-1042"],
      ["payer", "Invoice inv_M1042 stored. Merchant flexport.com is on this wallet's whitelist. Amount $42.00 is under the $50.00 ceiling. SUCCESS: Task completed"],
    ],
  }),
  acme_growth_03: scene({
    agentId: "acme_growth_03",
    department: "Growth Automation",
    companyId: "acme_ai",
    company: "Acme AI Corp",
    counterparty: "log_routing_09",
    counterpartyCompany: "Global Logistics Ltd",
    liveLine: "Buying the lane campaign on meta.com",
    invoice: { id: "inv_LANE18", merchant: "meta.com", amountUSD: 180, memo: "last-mile lane acquisition" },
    ceiling: "300.00",
    lines: [
      ["payer", "Intent [LANE_ACQUISITION]. Dispatch asked for a last-mile campaign. Bill meta.com. Ceiling on this wallet is $300.00."],
      ["counterparty", "Lane 18 is the one we need covered. Send the invoice request and I will price the flight."],
      ["payer", "Issue the invoice."],
      ["counterparty", "INVOICE inv_LANE18 | merchant: meta.com | amount: 180.00 | memo: last-mile lane acquisition"],
      ["payer", "Invoice inv_LANE18 stored. Merchant meta.com is on this wallet's whitelist. Amount $180.00 is under the $300.00 ceiling. SUCCESS: Task completed"],
    ],
  }),
  log_customs_04: scene({
    agentId: "log_customs_04",
    department: "Freight Customs",
    companyId: "global_logistics",
    company: "Global Logistics Ltd",
    counterparty: "acme_devops_01",
    counterpartyCompany: "Acme AI Corp",
    liveLine: "Paying the FedEx bill of lading",
    invoice: { id: "inv_BOL77", merchant: "fedex.com", amountUSD: 640, memo: "priority bill of lading" },
    ceiling: "5000.00",
    lines: [
      ["payer", "Intent [BILL_OF_LADING]. The label hook is live. Bill fedex.com for the priority bill. Ceiling on this wallet is $5,000.00."],
      ["counterparty", "Label hook is confirmed on our side. Ask and I will issue the FedEx invoice through Nexus."],
      ["payer", "Issue the invoice."],
      ["counterparty", "INVOICE inv_BOL77 | merchant: fedex.com | amount: 640.00 | memo: priority bill of lading"],
      ["payer", "Invoice inv_BOL77 stored. Merchant fedex.com is on this wallet's whitelist. Amount $640.00 is under the $5,000.00 ceiling. SUCCESS: Task completed"],
    ],
  }),
  log_routing_09: scene({
    agentId: "log_routing_09",
    department: "Last-Mile Dispatch",
    companyId: "global_logistics",
    company: "Global Logistics Ltd",
    counterparty: "acme_growth_03",
    counterpartyCompany: "Acme AI Corp",
    liveLine: "Reloading dispatch map tiles",
    invoice: { id: "inv_GEO09", merchant: "mapbox.com", amountUSD: 28, memo: "dispatch map tile reload" },
    ceiling: "120.00",
    lines: [
      ["payer", "Intent [MAP_TILE_RELOAD]. Growth locked the delivery zones. Bill mapbox.com. Ceiling on this wallet is $120.00."],
      ["counterparty", "Zones are locked. Ask and I will issue the map invoice on Nexus."],
      ["payer", "Issue the invoice."],
      ["counterparty", "INVOICE inv_GEO09 | merchant: mapbox.com | amount: 28.00 | memo: dispatch map tile reload"],
      ["payer", "Invoice inv_GEO09 stored. Merchant mapbox.com is on this wallet's whitelist. Amount $28.00 is under the $120.00 ceiling. SUCCESS: Task completed"],
    ],
  }),
};

function scene(spec) {
  return {
    ...spec,
    lines: spec.lines.map(([role, text]) => ({
      role,
      speaker: role === "payer" ? spec.agentId : spec.counterparty,
      company: role === "payer" ? spec.company : spec.counterpartyCompany,
      text,
    })),
  };
}

function resetDemoState() {
  wallets.clear();
  ledger.length = 0;
  sessions.clear();
  invoices.length = 0;
  const catalog = seedCatalog();
  Object.values(catalog).forEach((company) => {
    Object.values(company.departments).forEach((dept) => {
      wallets.set(dept.agentId, {
        agentId: dept.agentId,
        tenantId: company.id,
        tenantName: company.name,
        department: dept.label,
        balanceUSD: dept.balanceUSD,
        spendingLimitUSD: dept.spendingLimitUSD,
        allowedMerchants: [...dept.allowedMerchants],
        createdAt: new Date().toISOString(),
      });
    });
  });
}

resetDemoState();

function cors(res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function routePath(req) {
  const raw = (req.url || "").split("?")[0];
  return raw.replace(/\/+$/, "") || "/";
}

async function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch {
      return {};
    }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function money(n) {
  return Math.round(Number(n) * 100) / 100;
}

function publicWallet(wallet) {
  return {
    agentId: wallet.agentId,
    tenantId: wallet.tenantId,
    tenantName: wallet.tenantName,
    department: wallet.department,
    balanceUSD: wallet.balanceUSD,
    spendingLimitUSD: wallet.spendingLimitUSD,
    allowedMerchants: wallet.allowedMerchants,
  };
}

function handleCatalog() {
  return {
    environment: "sandbox",
    taskSuccessPhrase: TASK_SUCCESS_PHRASE,
    tenants: seedCatalog(),
    wallets: Array.from(wallets.values()).map(publicWallet),
  };
}

function createWallet(body) {
  const agentId = String(body.agentId || `agent_${Date.now().toString(36)}`).trim();
  const allowedMerchants = Array.isArray(body.allowedMerchants)
    ? body.allowedMerchants.map((m) => String(m).toLowerCase().trim()).filter(Boolean)
    : [];

  if (!allowedMerchants.length) {
    return {
      status: 400,
      payload: { status: "REJECTED", reason: "allowedMerchants must contain at least one domain." },
    };
  }

  const wallet = {
    agentId,
    tenantId: body.tenantId || "custom",
    tenantName: body.tenantName || "Custom tenant",
    department: body.department || "Unassigned",
    balanceUSD: money(body.balanceUSD ?? 100),
    spendingLimitUSD: money(body.spendingLimitUSD ?? 20),
    allowedMerchants,
    createdAt: new Date().toISOString(),
  };

  wallets.set(agentId, wallet);
  return { status: 201, payload: { status: "PROVISIONED", wallet: publicWallet(wallet) } };
}

function authorize(body) {
  const agentId = String(body.agentId || "").trim();
  const targetMerchant = String(body.targetMerchant || "").toLowerCase().trim();
  const transactionAmount = money(body.transactionAmount);
  const executionLog = String(body.executionLog || "");

  if (!agentId || !targetMerchant || !Number.isFinite(transactionAmount)) {
    return {
      status: 400,
      payload: {
        status: "DECLINED",
        reason: "Required fields: agentId, targetMerchant, transactionAmount, executionLog.",
      },
    };
  }

  const wallet = wallets.get(agentId);
  if (!wallet) {
    return {
      status: 404,
      payload: { status: "DECLINED", reason: `Unknown agent wallet [${agentId}]. Provision via /api/wallets/create.` },
    };
  }

  if (transactionAmount > wallet.spendingLimitUSD) {
    return {
      status: 403,
      payload: {
        status: "DECLINED",
        reason: `Transaction exceeds per-call ceiling of $${wallet.spendingLimitUSD.toFixed(2)}.`,
        wallet: publicWallet(wallet),
      },
    };
  }

  if (!wallet.allowedMerchants.includes(targetMerchant)) {
    return {
      status: 403,
      payload: {
        status: "DECLINED",
        reason: `Merchant [${targetMerchant}] is not on this agent's whitelist.`,
        wallet: publicWallet(wallet),
      },
    };
  }

  if (!executionLog.includes(TASK_SUCCESS_PHRASE)) {
    return {
      status: 422,
      payload: {
        status: "DECLINED",
        reason: `Task validation failed. Execution log must contain "${TASK_SUCCESS_PHRASE}".`,
        wallet: publicWallet(wallet),
      },
    };
  }

  if (transactionAmount > wallet.balanceUSD) {
    return {
      status: 403,
      payload: {
        status: "DECLINED",
        reason: "Insufficient wallet balance.",
        wallet: publicWallet(wallet),
      },
    };
  }

  wallet.balanceUSD = money(wallet.balanceUSD - transactionAmount);
  const transaction = {
    transactionId: `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    agentId,
    targetMerchant,
    transactionAmount,
    timestamp: new Date().toISOString(),
    remainingBalanceUSD: wallet.balanceUSD,
  };
  ledger.unshift(transaction);
  if (ledger.length > 50) ledger.pop();

  return {
    status: 200,
    payload: {
      status: "APPROVED_AND_SETTLED",
      ...transaction,
      wallet: publicWallet(wallet),
    },
  };
}

function sceneFor(agentId) {
  return SCENES[String(agentId || "")] || null;
}

function otherAgents(agentId) {
  return Object.values(SCENES)
    .filter((item) => item.agentId !== agentId)
    .map((item) => ({
      agentId: item.agentId,
      department: item.department,
      company: item.company,
      counterparty: item.counterparty,
      liveLine: item.liveLine,
    }));
}

function startDialogue(body) {
  const scene = sceneFor(body && body.agentId) || SCENES.acme_devops_01;
  const wallet = wallets.get(scene.agentId);
  return {
    status: 201,
    payload: {
      agentId: scene.agentId,
      department: scene.department,
      company: scene.company,
      counterparty: scene.counterparty,
      counterpartyCompany: scene.counterpartyCompany,
      total: scene.lines.length,
      wallet: wallet ? publicWallet(wallet) : null,
      others: otherAgents(scene.agentId),
    },
  };
}

function settleDialogue(scene, message, stepNumber) {
  const payload = {
    done: true,
    step: stepNumber,
    total: scene.lines.length,
    message,
  };
  const wallet = wallets.get(scene.agentId);
  const balanceBefore = wallet ? wallet.balanceUSD : null;
  const executionLog = scene.lines.map((line) => `${line.speaker}: ${line.text}`).join("\n");
  const result = authorize({
    agentId: scene.agentId,
    targetMerchant: scene.invoice.merchant,
    transactionAmount: scene.invoice.amountUSD,
    executionLog,
  });

  payload.balanceBefore = balanceBefore;
  payload.settlement = result.payload;
  payload.wallet = result.payload.wallet || (wallet ? publicWallet(wallet) : null);

  if (result.status === 200) {
    const stored = {
      ...scene.invoice,
      fromAgent: scene.counterparty,
      toAgent: scene.agentId,
      storedAt: result.payload.timestamp,
      transactionId: result.payload.transactionId,
    };
    invoices.unshift(stored);
    payload.invoice = stored;
  }

  return { status: result.status, payload };
}

function nextDialogue(body) {
  const scene = sceneFor(body && body.agentId) || SCENES.acme_devops_01;
  const step = Number(body && body.step);
  if (!Number.isInteger(step) || step < 0 || step >= scene.lines.length) {
    return { status: 400, payload: { status: "DECLINED", reason: "Dialogue step is out of range." } };
  }

  const message = scene.lines[step];
  const done = step === scene.lines.length - 1;
  if (!done) {
    return {
      status: 200,
      payload: { done: false, step: step + 1, total: scene.lines.length, message },
    };
  }

  return settleDialogue(scene, message, step + 1);
}

module.exports = async (req, res) => {
  cors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    return res.end();
  }

  const path = routePath(req);

  if (req.method === "GET" && (path === "/api/health" || path === "/api")) {
    return json(res, 200, { ok: true, product: "Nexus Agentic", wallets: wallets.size });
  }

  if (req.method === "GET" && path === "/api/catalog") {
    return json(res, 200, handleCatalog());
  }

  if (req.method === "POST" && path === "/api/wallets/create") {
    const result = createWallet(await readBody(req));
    return json(res, result.status, result.payload);
  }

  if (req.method === "POST" && path === "/api/demo/reset") {
    resetDemoState();
    return json(res, 200, { status: "RESET", wallets: handleCatalog().wallets });
  }

  if (req.method === "POST" && path === "/api/dialogue/start") {
    const result = startDialogue(await readBody(req));
    return json(res, result.status, result.payload);
  }

  if (req.method === "POST" && path === "/api/dialogue/next") {
    const result = nextDialogue(await readBody(req));
    return json(res, result.status, result.payload);
  }

  if (
    req.method === "POST" &&
    (path === "/api/transactions/authorize" || path === "/api/authorize")
  ) {
    const result = authorize(await readBody(req));
    return json(res, result.status, result.payload);
  }

  if (req.method === "POST") {
    return json(res, 404, { error: `Unknown API route ${path}` });
  }

  return json(res, 405, { error: "Method not allowed." });
};
