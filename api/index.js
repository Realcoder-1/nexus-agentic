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
      name: "Acme",
      type: "AI lab",
      departments: {
        engineering: dept("acme_engineering", "Engineering", 8500, 50, ["flexport.com", "github.com", "vercel.com"]),
        marketing: dept("acme_marketing", "Marketing", 24000, 300, ["meta.com", "google.com"]),
        research: dept("acme_research", "Research", 1200, 25, ["openai.com"]),
      },
    },
    global_logistics: {
      id: "global_logistics",
      name: "Logistics",
      type: "Supply chain",
      departments: {
        customs: dept("log_customs", "Customs", 145000, 5000, ["fedex.com", "flexport.com"]),
        dispatch: dept("log_dispatch", "Dispatch", 1800, 120, ["twilio.com", "mapbox.com"]),
        warehouse: dept("log_warehouse", "Warehouse", 4200, 40, ["mapbox.com", "openai.com"]),
      },
    },
  };
}

function dept(agentId, label, balanceUSD, spendingLimitUSD, allowedMerchants) {
  return { key: label.toLowerCase(), label, agentId, balanceUSD, spendingLimitUSD, allowedMerchants };
}

/** Who pays whom, and for what. Amounts sit under the payer ceiling unless the UI sends an overspend. */
const PAIRS = {
  acme_engineering: pair("log_customs", "flexport.com", 42, "clear a shipment", "inv_ship_1"),
  acme_marketing: pair("log_dispatch", "meta.com", 180, "buy delivery ads", "inv_ads_1"),
  acme_research: pair("log_warehouse", "openai.com", 18, "run a model job", "inv_model_1"),
  log_customs: pair("acme_engineering", "fedex.com", 640, "print a shipping label", "inv_label_1"),
  log_dispatch: pair("acme_marketing", "twilio.com", 28, "send delivery texts", "inv_sms_1"),
  log_warehouse: pair("acme_research", "mapbox.com", 35, "find stock on a map", "inv_map_1"),
};

function pair(counterparty, merchant, amountUSD, memo, invoiceId) {
  return { counterparty, merchant, amountUSD, memo, invoiceId };
}

/** In-process ledger. Demo only — resets on serverless cold start. */
const wallets = new Map();
const ledger = [];
const sessions = new Map();
const invoices = [];

function usd(n) {
  return Number(n).toFixed(2);
}

function buildExchange(payerId, amountUSD) {
  const pair = PAIRS[payerId] || PAIRS.acme_engineering;
  const payer = wallets.get(payerId) || wallets.get("acme_engineering");
  const receiver = wallets.get(pair.counterparty);
  const amount = money(amountUSD == null ? pair.amountUSD : amountUSD);
  const allowed = payer.allowedMerchants.includes(pair.merchant);
  const underCeiling = amount <= payer.spendingLimitUSD;
  const solvent = amount <= payer.balanceUSD;

  let stop = "";
  if (!allowed) stop = `${pair.merchant} is not on ${payer.department}'s allowed list.`;
  else if (!underCeiling) stop = `$${usd(amount)} is over the $${usd(payer.spendingLimitUSD)} ceiling.`;
  else if (!solvent) stop = `${payer.department} does not have enough balance.`;

  const ok = !stop;
  const lines = [
    {
      role: "payer",
      speaker: payer.department,
      company: payer.tenantName,
      agentId: payer.agentId,
      text: `Need to ${pair.memo}. Pay ${pair.merchant} $${usd(amount)}. My ceiling is $${usd(payer.spendingLimitUSD)}.`,
    },
    {
      role: "receiver",
      speaker: receiver.department,
      company: receiver.tenantName,
      agentId: receiver.agentId,
      text: `Invoice ${pair.invoiceId} for $${usd(amount)} is ready.`,
    },
    {
      role: "payer",
      speaker: payer.department,
      company: payer.tenantName,
      agentId: payer.agentId,
      text: ok
        ? `${pair.merchant} is allowed. Amount is under the ceiling. SUCCESS: Task completed`
        : `${stop} I will not pay.`,
    },
    {
      role: "receiver",
      speaker: receiver.department,
      company: receiver.tenantName,
      agentId: receiver.agentId,
      text: ok ? `Payment received from ${payer.department}.` : `No payment from ${payer.department}.`,
    },
  ];

  return {
    agentId: payer.agentId,
    department: payer.department,
    company: payer.tenantName,
    counterparty: receiver.agentId,
    counterpartyDepartment: receiver.department,
    counterpartyCompany: receiver.tenantName,
    merchant: pair.merchant,
    memo: pair.memo,
    invoiceId: pair.invoiceId,
    amountUSD: amount,
    ok,
    lines,
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
  const queryPath = req.query && (req.query.__path || req.query.path);
  if (Array.isArray(queryPath) && queryPath.length) {
    return (`/api/${queryPath.filter(Boolean).join("/")}`).replace(/\/+$/, "") || "/api";
  }
  if (typeof queryPath === "string" && queryPath.length) {
    const value = queryPath.startsWith("/") ? queryPath : `/api/${queryPath}`;
    return value.replace(/\/+$/, "") || "/api";
  }
  const invoke = req.headers && (req.headers["x-invoke-path"] || req.headers["x-matched-path"]);
  if (typeof invoke === "string" && invoke.includes("/api")) {
    const clipped = invoke.startsWith("/api") ? invoke : invoke.slice(invoke.indexOf("/api"));
    return clipped.split("?")[0].replace(/\/+$/, "") || "/api";
  }
  const raw = (req.url || "").split("?")[0];
  if (raw && raw !== "/" && raw !== "/api") return raw.replace(/\/+$/, "") || "/api";
  try {
    const search = new URL(req.url || "", "http://n.local").searchParams.get("__path");
    if (search) return search.replace(/\/+$/, "") || "/api";
  } catch {
    /* ignore malformed urls */
  }
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
  const tenants = seedCatalog();
  const pairs = {};
  Object.entries(PAIRS).forEach(([agentId, pair]) => {
    const payer = wallets.get(agentId);
    const receiver = wallets.get(pair.counterparty);
    pairs[agentId] = {
      ...pair,
      department: payer ? payer.department : agentId,
      company: payer ? payer.tenantName : "",
      ceilingUSD: payer ? payer.spendingLimitUSD : 0,
      counterpartyDepartment: receiver ? receiver.department : pair.counterparty,
      counterpartyCompany: receiver ? receiver.tenantName : "",
    };
  });
  return {
    environment: "sandbox",
    taskSuccessPhrase: TASK_SUCCESS_PHRASE,
    tenants,
    wallets: Array.from(wallets.values()).map(publicWallet),
    pairs,
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
  let counterpartyWallet = null;
  const creditId = String(body.creditAgentId || "").trim();
  if (creditId && creditId !== agentId && wallets.has(creditId)) {
    const payee = wallets.get(creditId);
    payee.balanceUSD = money(payee.balanceUSD + transactionAmount);
    counterpartyWallet = publicWallet(payee);
  }
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
      counterpartyWallet,
    },
  };
}

function sessionPayload(exchange) {
  return {
    agentId: exchange.agentId,
    department: exchange.department,
    company: exchange.company,
    counterparty: exchange.counterparty,
    counterpartyDepartment: exchange.counterpartyDepartment,
    counterpartyCompany: exchange.counterpartyCompany,
    merchant: exchange.merchant,
    memo: exchange.memo,
    amountUSD: exchange.amountUSD,
    total: exchange.lines.length,
    willClear: exchange.ok,
    wallet: publicWallet(wallets.get(exchange.agentId)),
    receiverWallet: publicWallet(wallets.get(exchange.counterparty)),
  };
}

function startDialogue(body) {
  const agentId = String((body && body.agentId) || "acme_engineering");
  const exchange = buildExchange(agentId, body && body.amountUSD);
  sessions.set(agentId, exchange);
  return { status: 201, payload: sessionPayload(exchange) };
}

function settleDialogue(exchange, message, stepNumber) {
  const payload = {
    done: true,
    step: stepNumber,
    total: exchange.lines.length,
    message,
    wallet: publicWallet(wallets.get(exchange.agentId)),
    receiverWallet: publicWallet(wallets.get(exchange.counterparty)),
  };
  const executionLog = exchange.lines.map((line) => `${line.speaker}: ${line.text}`).join("\n");
  const result = authorize({
    agentId: exchange.agentId,
    targetMerchant: exchange.merchant,
    transactionAmount: exchange.amountUSD,
    executionLog,
    creditAgentId: exchange.counterparty,
  });

  payload.settlement = result.payload;
  payload.wallet = result.payload.wallet || payload.wallet;
  payload.receiverWallet = result.payload.counterpartyWallet || payload.receiverWallet;

  if (result.status === 200) {
    const stored = {
      id: exchange.invoiceId,
      merchant: exchange.merchant,
      amountUSD: exchange.amountUSD,
      memo: exchange.memo,
      fromAgent: exchange.agentId,
      toAgent: exchange.counterparty,
      storedAt: result.payload.timestamp,
      transactionId: result.payload.transactionId,
    };
    invoices.unshift(stored);
    payload.invoice = stored;
  }

  return { status: result.status === 200 || !exchange.ok ? 200 : result.status, payload };
}

function nextDialogue(body) {
  const agentId = String((body && body.agentId) || "acme_engineering");
  const exchange = sessions.get(agentId) || buildExchange(agentId, body && body.amountUSD);
  const step = Number(body && body.step);
  if (!Number.isInteger(step) || step < 0 || step >= exchange.lines.length) {
    return { status: 400, payload: { status: "DECLINED", reason: "Dialogue step is out of range." } };
  }

  const message = exchange.lines[step];
  const done = step === exchange.lines.length - 1;
  if (!done) {
    return {
      status: 200,
      payload: {
        done: false,
        step: step + 1,
        total: exchange.lines.length,
        message,
        wallet: publicWallet(wallets.get(exchange.agentId)),
        receiverWallet: publicWallet(wallets.get(exchange.counterparty)),
      },
    };
  }

  return settleDialogue(exchange, message, step + 1);
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
