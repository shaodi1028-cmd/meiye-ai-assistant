const http = require("http");
const fs = require("fs");
const path = require("path");
const { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } = require("crypto");
const { createJsonStore } = require("./lib/json-store");

loadEnvFile();

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const ROOT = __dirname;
const DOMAIN_PATH = path.join(ROOT, "data", "models", "beauty-domain.json");
const dataStore = createJsonStore({ root: ROOT });

const platformNames = {
  xhs: "小红书",
  douyin: "抖音",
  moments: "朋友圈",
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    setBaseHeaders(res);
    if (url.pathname.startsWith("/api/") || url.pathname === "/healthz") {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(res, url.pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, error.statusCode || 500, {
      error: error.code || "SERVER_ERROR",
      message: error.message || "服务器处理失败",
    });
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
    console.log(`美业 AI 运营助手已启动：http://${displayHost}:${PORT}`);
  });
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && (url.pathname === "/api/health" || url.pathname === "/healthz")) {
    sendJson(res, 200, buildHealthState());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await readJson(req);
    const db = readDb();
    const authResult = registerBossAccount(db, body);
    writeDb(db);
    sendJson(res, 200, { user: authResult.user, token: authResult.token, state: buildState(db, authResult.user) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readJson(req);
    const db = readDb();
    const authResult = loginWithPassword(db, body);
    writeDb(db);
    sendJson(res, 200, { user: authResult.user, token: authResult.token, state: buildState(db, authResult.user) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/auth/session") {
    const db = readDb();
    const user = getUserFromRequest(req, db);
    if (!user) {
      sendJson(res, 401, { error: "UNAUTHORIZED", message: "登录已过期，请重新登录" });
      return;
    }
    sendJson(res, 200, { user, state: buildState(db, user) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readJson(req);
    const db = readDb();
    const user = db.users[body.userId];
    if (!user) {
      sendJson(res, 401, { error: "INVALID_USER", message: "账号不存在" });
      return;
    }
    sendJson(res, 200, { user, state: buildState(db, user) });
    return;
  }

  const db = readDb();
  const user = getUserFromRequest(req, db);
  if (!user) {
    sendJson(res, 401, { error: "UNAUTHORIZED", message: "请先登录" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, buildState(db, user));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/vertical-models") {
    sendJson(res, 200, buildVerticalModelInfo());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/services") {
    sendJson(res, 200, { services: db.services || {} });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/assets") {
    sendJson(res, 200, { assets: db.assets || {} });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/billing") {
    sendJson(res, 200, buildBillingState(db));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/backups/export") {
    requireBoss(user);
    sendJson(res, 200, buildBackupExport(db));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/backups") {
    requireBoss(user);
    sendJson(res, 200, { backups: dataStore.listBackups() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/backups/import") {
    requireBoss(user);
    const body = await readJson(req);
    const nextDb = validateImportedDb(body.backup || body);
    dataStore.createBackup(db, "before-import");
    const nextUser = nextDb.users[user.id] || Object.values(nextDb.users).find((item) => item.role === "boss") || user;
    const authResult = issueSession(nextDb, nextUser);
    writeDb(nextDb);
    sendJson(res, 200, { user: authResult.user, token: authResult.token, state: buildState(nextDb, authResult.user) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/billing/plan") {
    requireBoss(user);
    const body = await readJson(req);
    applySubscriptionPlan(db, body.planId);
    writeDb(db);
    sendJson(res, 200, buildState(db, user));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/services") {
    requireBoss(user);
    const body = await readJson(req);
    const service = normalizeService(body);
    service.id = `svc_${Date.now()}`;
    db.services = db.services || {};
    db.services[service.id] = service;
    writeDb(db);
    sendJson(res, 200, buildState(db, user));
    return;
  }

  const serviceMatch = url.pathname.match(/^\/api\/services\/([^/]+)$/);
  if (serviceMatch && req.method === "PUT") {
    requireBoss(user);
    const serviceId = serviceMatch[1];
    if (!db.services?.[serviceId]) {
      sendJson(res, 404, { error: "SERVICE_NOT_FOUND", message: "项目不存在" });
      return;
    }
    const body = await readJson(req);
    db.services[serviceId] = { ...normalizeService(body), id: serviceId };
    writeDb(db);
    sendJson(res, 200, buildState(db, user));
    return;
  }

  if (serviceMatch && req.method === "DELETE") {
    requireBoss(user);
    const serviceId = serviceMatch[1];
    if (!db.services?.[serviceId]) {
      sendJson(res, 404, { error: "SERVICE_NOT_FOUND", message: "项目不存在" });
      return;
    }
    delete db.services[serviceId];
    writeDb(db);
    sendJson(res, 200, buildState(db, user));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/assets") {
    requireBoss(user);
    const body = await readJson(req);
    const asset = normalizeAsset(body, db);
    asset.id = `asset_${Date.now()}`;
    db.assets = db.assets || {};
    db.assets[asset.id] = asset;
    writeDb(db);
    sendJson(res, 200, buildState(db, user));
    return;
  }

  const assetMatch = url.pathname.match(/^\/api\/assets\/([^/]+)$/);
  if (assetMatch && req.method === "PUT") {
    requireBoss(user);
    const assetId = assetMatch[1];
    if (!db.assets?.[assetId]) {
      sendJson(res, 404, { error: "ASSET_NOT_FOUND", message: "素材不存在" });
      return;
    }
    const body = await readJson(req);
    db.assets[assetId] = { ...normalizeAsset(body, db), id: assetId };
    writeDb(db);
    sendJson(res, 200, buildState(db, user));
    return;
  }

  if (assetMatch && req.method === "DELETE") {
    requireBoss(user);
    const assetId = assetMatch[1];
    if (!db.assets?.[assetId]) {
      sendJson(res, 404, { error: "ASSET_NOT_FOUND", message: "素材不存在" });
      return;
    }
    delete db.assets[assetId];
    writeDb(db);
    sendJson(res, 200, buildState(db, user));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tasks") {
    requireBoss(user);
    const body = await readJson(req);
    const employee = db.employees[body.employeeId];
    if (!employee) {
      sendJson(res, 404, { error: "EMPLOYEE_NOT_FOUND", message: "员工不存在" });
      return;
    }
    employee.tasks = normalizeTasks(body.tasks);
    clampDone(employee);
    writeDb(db);
    sendJson(res, 200, buildState(db, user));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/submissions") {
    const body = await readJson(req);
    const employeeId = user.role === "boss" ? body.employeeId : user.id;
    const employee = db.employees[employeeId];
    if (!employee) {
      sendJson(res, 404, { error: "EMPLOYEE_NOT_FOUND", message: "员工不存在" });
      return;
    }
    const platform = String(body.platform || "");
    const key = getPlatformKey(platform);
    const link = String(body.link || "").trim();
    if (!key || !link) {
      sendJson(res, 400, { error: "INVALID_SUBMISSION", message: "请填写平台和发布链接" });
      return;
    }
    employee.done[key] = Math.min(employee.done[key] + 1, employee.tasks[key]);
    db.submissions.unshift({
      id: `sub_${randomUUID()}`,
      employeeId,
      platform,
      link,
      date: today(),
      time: nowTime(),
      status: "pending",
    });
    writeDb(db);
    sendJson(res, 200, buildState(db, user));
    return;
  }

  const submissionReviewMatch = url.pathname.match(/^\/api\/submissions\/([^/]+)\/review$/);
  if (submissionReviewMatch && req.method === "POST") {
    requireBoss(user);
    const submissionId = submissionReviewMatch[1];
    const submission = db.submissions.find((item) => item.id === submissionId);
    if (!submission) {
      sendJson(res, 404, { error: "SUBMISSION_NOT_FOUND", message: "提交记录不存在" });
      return;
    }
    const body = await readJson(req);
    const status = clean(body.status);
    if (!["approved", "rejected"].includes(status)) {
      sendJson(res, 400, { error: "INVALID_REVIEW", message: "审核状态不正确" });
      return;
    }
    submission.status = status;
    submission.reviewNote = clean(body.reviewNote);
    submission.reviewedAt = `${today()} ${nowTime()}`;
    submission.reviewedBy = user.id;
    writeDb(db);
    sendJson(res, 200, buildState(db, user));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/generate") {
    const body = await readJson(req);
    if (isQuotaExhausted(db)) {
      sendJson(res, 402, {
        error: "QUOTA_EXHAUSTED",
        message: "本月生成额度已用完，请升级订阅或下月继续使用",
        billing: buildBillingState(db),
      });
      return;
    }
    const serviceProfile = db.services?.[body.serviceProfileId] || null;
    const relatedAssets = findRelatedAssets(db, body.serviceProfileId, user.id);
    const generation = await generateContent(body, serviceProfile, {
      user,
      generationIndex: db.store.generationUsed,
      existingGenerations: db.generations,
      relatedAssets,
      employeeProfile: db.employees[user.id],
    });
    db.generations.unshift({
      id: `gen_${randomUUID()}`,
      userId: user.id,
      type: body.contentType,
      title: generation.title,
      input: body,
      blocks: generation.blocks,
      modelMeta: generation.modelMeta,
      date: today(),
      time: nowTime(),
    });
    db.store.generationUsed += 1;
    writeDb(db);
    sendJson(res, 200, {
      title: generation.title,
      blocks: generation.blocks,
      modelMeta: generation.modelMeta,
      generationUsed: db.store.generationUsed,
      generationQuota: db.store.generationQuota,
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/employees") {
    requireBoss(user);
    const body = await readJson(req);
    const { employeeLogin } = createEmployeeAccount(db, body);
    writeDb(db);
    sendJson(res, 200, {
      ...buildState(db, user),
      employeeLogin,
    });
    return;
  }

  sendJson(res, 404, { error: "NOT_FOUND", message: "接口不存在" });
}

function serveStatic(res, requestPath) {
  const normalizedPath = requestPath === "/" ? "/index.html" : decodeURIComponent(requestPath);
  const filePath = path.normalize(path.join(ROOT, normalizedPath));
  if (!filePath.startsWith(ROOT)) {
    sendText(res, 403, "Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(res, 404, "Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  });
}

function buildHealthState() {
  return {
    ok: true,
    service: "meiye-ai-assistant",
    version: process.env.npm_package_version || "0.2.0",
    environment: process.env.NODE_ENV || "development",
    storage: {
      ...dataStore.health(),
    },
    modelProvider: getConfiguredProvider()?.name || "local-template",
    time: new Date().toISOString(),
  };
}

function buildBackupExport(db) {
  return dataStore.buildExport(db);
}

function validateImportedDb(payload = {}) {
  return dataStore.validateImport(payload);
}

function buildState(db, user) {
  const employees = filterEmployeesForUser(db.employees, user);
  return {
    user,
    store: db.store,
    employees,
    submissions: db.submissions.filter((item) => user.role === "boss" || item.employeeId === user.id),
    generations: db.generations.filter((item) => user.role === "boss" || item.userId === user.id).slice(0, 20),
    accounts: Object.values(db.users),
    services: db.services || {},
    assets: db.assets || {},
    billing: buildBillingState(db),
  };
}

function filterEmployeesForUser(employees, user) {
  if (user.role === "boss") return employees;
  return { [user.id]: employees[user.id] };
}

function getUserFromRequest(req, db) {
  const token = req.headers["x-session-token"];
  if (token) {
    return getUserBySessionToken(db, token);
  }
  const userId = req.headers["x-user-id"];
  return userId ? db.users[userId] : null;
}

function requireBoss(user) {
  if (user.role !== "boss") {
    const error = new Error("只有老板账号可以操作");
    error.statusCode = 403;
    error.code = "FORBIDDEN";
    throw error;
  }
}

function readDb() {
  return dataStore.read();
}

function readDomain() {
  return JSON.parse(fs.readFileSync(DOMAIN_PATH, "utf8"));
}

function writeDb(db) {
  dataStore.write(db);
}

function ensureAuth(db) {
  db.auth = db.auth || { accounts: {}, sessions: {} };
  db.auth.accounts = db.auth.accounts || {};
  db.auth.sessions = db.auth.sessions || {};
  return db.auth;
}

function registerBossAccount(db, input = {}) {
  const phone = normalizePhone(input.phone);
  const password = clean(input.password);
  const name = clean(input.name) || "门店老板";
  const storeName = clean(input.storeName) || "我的美业门店";
  if (!phone || phone.length < 6) {
    authError("手机号不能为空", "INVALID_PHONE");
  }
  if (password.length < 6) {
    authError("密码至少需要 6 位", "WEAK_PASSWORD");
  }
  if (findUserIdByPhone(db, phone)) {
    authError("这个手机号已经注册过", "PHONE_EXISTS", 409);
  }
  const userId = `boss_${Date.now()}`;
  db.store.name = storeName;
  db.users[userId] = {
    id: userId,
    name,
    role: "boss",
    title: "门店老板",
  };
  upsertAuthAccount(db, { userId, phone, password, role: "boss" });
  return issueSession(db, db.users[userId]);
}

function createEmployeeAccount(db, input = {}) {
  const id = `emp_${randomUUID().slice(0, 8)}`;
  const name = clean(input.name);
  const role = clean(input.role) || "员工";
  const focus = clean(input.focus) || "门店内容发布";
  const phone = normalizePhone(input.phone);
  const password = clean(input.password) || "123456";
  if (!name) {
    authError("员工姓名不能为空", "INVALID_EMPLOYEE");
  }
  if (phone && password.length < 6) {
    authError("员工初始密码至少需要 6 位", "WEAK_PASSWORD");
  }
  if (phone && findUserIdByPhone(db, phone)) {
    authError("这个手机号已经注册过", "PHONE_EXISTS", 409);
  }
  db.users[id] = {
    id,
    name,
    role: "employee",
    title: role,
  };
  db.employees[id] = {
    id,
    name,
    role,
    focus,
    tasks: { xhs: 1, douyin: 1, moments: 1 },
    done: { xhs: 0, douyin: 0, moments: 0 },
  };
  if (phone) {
    upsertAuthAccount(db, {
      userId: id,
      phone,
      password,
      role: "employee",
    });
  }
  return {
    employee: db.employees[id],
    employeeLogin: phone ? { phone, password } : null,
  };
}

function loginWithPassword(db, input = {}) {
  const phone = normalizePhone(input.phone);
  const password = clean(input.password);
  const userId = findUserIdByPhone(db, phone);
  if (!userId) {
    authError("手机号或密码不正确", "INVALID_CREDENTIALS", 401);
  }
  const account = ensureAuth(db).accounts[userId];
  if (!account || !verifyPassword(password, account.passwordHash)) {
    authError("手机号或密码不正确", "INVALID_CREDENTIALS", 401);
  }
  const user = db.users[userId];
  if (!user) {
    authError("账号不存在", "INVALID_USER", 401);
  }
  return issueSession(db, user);
}

function upsertAuthAccount(db, { userId, phone, password, role }) {
  ensureAuth(db).accounts[userId] = {
    userId,
    phone,
    role,
    passwordHash: createPasswordHash(password),
    createdAt: new Date().toISOString(),
  };
}

function issueSession(db, user) {
  const auth = ensureAuth(db);
  const token = randomBytes(32).toString("hex");
  auth.sessions[token] = {
    token,
    userId: user.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  };
  pruneExpiredSessions(db);
  return { user, token };
}

function getUserBySessionToken(db, token) {
  const session = ensureAuth(db).sessions[String(token || "")];
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) return null;
  return db.users[session.userId] || null;
}

function pruneExpiredSessions(db) {
  const sessions = ensureAuth(db).sessions;
  Object.keys(sessions).forEach((token) => {
    if (new Date(sessions[token].expiresAt).getTime() < Date.now()) {
      delete sessions[token];
    }
  });
}

function findUserIdByPhone(db, phone) {
  const normalizedPhone = normalizePhone(phone);
  const accounts = ensureAuth(db).accounts;
  return Object.values(accounts).find((account) => account.phone === normalizedPhone)?.userId || "";
}

function createPasswordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(String(password || ""), salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

function verifyPassword(password, storedHash = "") {
  const [scheme, rounds, salt, hash] = storedHash.split("$");
  if (scheme !== "pbkdf2_sha256" || !rounds || !salt || !hash) return false;
  const candidate = pbkdf2Sync(String(password || ""), salt, Number(rounds), 32, "sha256");
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").slice(0, 32);
}

function authError(message, code, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  throw error;
}

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) return;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  });
}

function setBaseHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Cache-Control", process.env.NODE_ENV === "production" ? "no-store" : "no-cache");
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function normalizeTasks(tasks = {}) {
  return {
    xhs: toCount(tasks.xhs),
    douyin: toCount(tasks.douyin),
    moments: toCount(tasks.moments),
  };
}

function toCount(value) {
  return Math.max(0, Math.min(Number.parseInt(value, 10) || 0, 20));
}

function clampDone(employee) {
  Object.keys(employee.done).forEach((key) => {
    employee.done[key] = Math.min(employee.done[key], employee.tasks[key]);
  });
}

function normalizeService(input = {}) {
  const name = clean(input.name);
  if (!name) {
    const error = new Error("项目名称不能为空");
    error.statusCode = 400;
    error.code = "INVALID_SERVICE";
    throw error;
  }
  return {
    id: clean(input.id),
    category: clean(input.category) || "美甲",
    name,
    price: clean(input.price) || "到店咨询",
    duration: clean(input.duration) || "到店沟通后确认",
    suitableFor: toList(input.suitableFor),
    sellingPoints: toList(input.sellingPoints),
    cautions: toList(input.cautions),
    contraindications: toList(input.contraindications || input.cautions),
    aftercare: toList(input.aftercare),
    upsellSuggestions: toList(input.upsellSuggestions),
    materialKeywords: toList(input.materialKeywords),
    shootingAngles: toList(input.shootingAngles),
    caseNotes: clean(input.caseNotes) || "使用真实案例表达，避免夸大承诺。",
  };
}

function normalizeAsset(input = {}, db) {
  const title = clean(input.title);
  if (!title) {
    const error = new Error("素材标题不能为空");
    error.statusCode = 400;
    error.code = "INVALID_ASSET";
    throw error;
  }
  const serviceId = clean(input.serviceId);
  const employeeId = clean(input.employeeId);
  return {
    id: clean(input.id),
    serviceId: db.services?.[serviceId] ? serviceId : "",
    employeeId: db.employees?.[employeeId] ? employeeId : "",
    type: clean(input.type) || "case_image",
    title,
    url: clean(input.url),
    tags: toList(input.tags),
    usageNotes: clean(input.usageNotes) || "适合生成门店自媒体内容时引用。",
    complianceNotes: clean(input.complianceNotes) || "发布前确认项目真实信息和合规表达。",
  };
}

function billingPlans() {
  return {
    starter: {
      planId: "starter",
      planName: "单店基础版",
      billingMode: "monthly",
      priceMonthly: 199,
      employeeLimit: 3,
      quotaMonthly: 300,
    },
    pro: {
      planId: "pro",
      planName: "门店专业版",
      billingMode: "monthly",
      priceMonthly: 399,
      employeeLimit: 10,
      quotaMonthly: 1000,
    },
    chain: {
      planId: "chain",
      planName: "连锁多店版",
      billingMode: "monthly",
      priceMonthly: 999,
      employeeLimit: 50,
      quotaMonthly: 5000,
    },
    trial_pro: {
      planId: "trial_pro",
      planName: "专业版试用",
      billingMode: "trial",
      priceMonthly: 0,
      employeeLimit: 10,
      quotaMonthly: 500,
    },
  };
}

function buildBillingState(db) {
  const plans = billingPlans();
  const subscription = db.store.subscription || {
    ...plans.trial_pro,
    currentPeriod: "2026-06",
    renewsAt: "2026-06-30",
    status: "active",
  };
  const quota = subscription.quotaMonthly || db.store.generationQuota || 0;
  const used = db.store.generationUsed || 0;
  return {
    subscription,
    plans,
    used,
    quota,
    remaining: Math.max(quota - used, 0),
    usageRate: quota ? Math.min(Math.round((used / quota) * 100), 100) : 0,
  };
}

function applySubscriptionPlan(db, planId) {
  const plan = billingPlans()[planId];
  if (!plan) {
    const error = new Error("订阅方案不存在");
    error.statusCode = 400;
    error.code = "INVALID_PLAN";
    throw error;
  }
  db.store.subscription = {
    ...plan,
    currentPeriod: db.store.subscription?.currentPeriod || "2026-06",
    renewsAt: db.store.subscription?.renewsAt || "2026-06-30",
    status: "active",
  };
  db.store.plan = plan.planName;
  db.store.generationQuota = plan.quotaMonthly;
}

function isQuotaExhausted(db) {
  const billing = buildBillingState(db);
  return billing.remaining <= 0;
}

function findRelatedAssets(db, serviceId, employeeId) {
  return Object.values(db.assets || {})
    .filter((asset) => asset.serviceId === serviceId || asset.employeeId === employeeId)
    .slice(0, 6);
}

function toList(value) {
  if (Array.isArray(value)) {
    return value.map(clean).filter(Boolean).slice(0, 12);
  }
  return String(value || "")
    .split(/[\n,，、;；]/)
    .map(clean)
    .filter(Boolean)
    .slice(0, 12);
}

function getPlatformKey(platform) {
  return Object.entries(platformNames).find(([, name]) => name === platform)?.[0];
}

function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

function nowTime() {
  return new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai",
  });
}

function resultTitle(contentType) {
  return {
    xhs: "小红书图文方案",
    copy: "通用自媒体文案",
    image: "图片生成方案",
    video: "短视频脚本方案",
  }[contentType] || "内容方案";
}

async function generateContentBlocks(input, serviceProfile, options = {}) {
  return (await generateContent(input, serviceProfile, options)).blocks;
}

async function generateContent(input, serviceProfile = null, options = {}) {
  const domain = readDomain();
  const data = {
    serviceName: clean(input.serviceName) || serviceProfile?.name || "夏日显白冰透美甲套餐",
    offer: clean(input.offer) || serviceProfile?.price || "新客到店 168 元",
    goal: clean(input.goal) || "引流到店",
    tone: clean(input.tone) || "真实种草",
    storeFeature: clean(input.storeFeature) || "带轻医美项目，美甲、美睫、皮肤管理可以一次安排。",
    serviceProfile,
    relatedAssets: options.relatedAssets || [],
    employeeProfile: options.employeeProfile || null,
  };
  const contentType = clean(input.contentType) || "xhs";
  const platform = inferPlatform(contentType);
  const variation = buildVariationStrategy(input, serviceProfile, options);
  const serviceMatches = identifyServiceCategories(data, domain);
  const compliance = buildComplianceNotes(data, domain, serviceMatches);
  const modelMeta = {
    vertical: true,
    domainVersion: domain.version,
    modelType: getModelType(contentType, domain),
    domain: getModelDomain(contentType, domain),
    platform,
    platformName: domain.platformPlaybooks[platform]?.name || "通用平台",
    serviceCategories: serviceMatches.map((match) => match.name),
    qualityChecklist: domain.qualityChecklist,
    complianceNotes: compliance,
  };

  const enrichedData = {
    ...data,
    platform,
    variation,
    playbook: domain.platformPlaybooks[platform],
    categoryNames: serviceMatches.map((match) => match.name),
    sellingPoints: collectUnique(serviceMatches.flatMap((match) => match.sellingPoints)).slice(0, 5),
    contentAngles: collectUnique(serviceMatches.flatMap((match) => match.contentAngles)).slice(0, 5),
    compliance,
  };
  const localBlocks = {
    xhs: buildXhs(enrichedData),
    copy: buildCopy(enrichedData),
    image: buildImage(enrichedData),
    video: buildVideo(enrichedData),
  }[contentType] || buildXhs(enrichedData);
  const modelBlocks = await tryGenerateWithExternalModel({
    input,
    data: enrichedData,
    domain,
    modelMeta,
    variation,
    localBlocks,
  });

  return {
    title: resultTitle(contentType),
    blocks: [
      ...modelBlocks,
      buildVariationBlock(variation),
      buildEmployeeProfileBlock(options.employeeProfile),
      buildAssetReferenceBlock(options.relatedAssets),
      buildServiceProfileBlock(serviceProfile),
      buildVerticalAuditBlock(modelMeta),
      buildComplianceBlock(compliance),
    ].filter(Boolean),
    modelMeta,
  };
}

function clean(value) {
  return String(value || "").trim().slice(0, 800);
}

function buildXhs(data) {
  return [
    {
      title: "标题备选",
      lines: [
        `${data.variation.hook}：${data.serviceName}`,
        `${data.variation.audience}适合的${data.serviceName}，不是越夸张越好看`,
        `${data.variation.scene}也能安排的变美项目，重点是${data.variation.angle}`,
      ],
    },
    {
      title: "正文",
      text: `${data.variation.opening}。这个${data.serviceName}这次主要从「${data.variation.angle}」的角度来讲，适合${data.variation.audience}。\n\n这次活动是${data.offer}，服务时长参考：${data.serviceProfile?.duration || "到店沟通后确认"}。我们门店的优势是${data.storeFeature}。如果你是第一次做，可以先说自己的日常习惯，我们会按手型、眼型、肤质状态和通勤场景给你搭配。\n\n适合人群：${formatList(data.serviceProfile?.suitableFor) || "想换风格、平时没时间反复跑店、希望美甲美睫和皮肤状态一起安排的顾客"}。\n\n${data.variation.cta}`,
    },
    {
      title: "标签",
      lines: ["#美甲显白", "#美甲美睫同店", "#轻医美皮肤管理", "#本地探店", "#新客活动", "#上班族变美"],
    },
    {
      title: "封面建议",
      text: `用真实案例近景做主图，优先展示${data.categoryNames.join("、")}的完成效果。角落放价格和项目名，文字控制在 8 个字以内：显白冰透感。不要把优惠信息堆满封面。`,
    },
  ];
}

function buildCopy(data) {
  return [
    {
      title: "朋友圈文案",
      text: `${data.variation.opening}。\n\n今天推荐的是${data.serviceName}，重点是${data.variation.angle}。${data.offer}，到店可以顺便安排美睫或皮肤管理，时间更省。\n\n${data.variation.cta}`,
    },
    {
      title: "抖音口播",
      text: `${data.variation.hook}。如果你是${data.variation.audience}，可以看看我们店的${data.serviceName}。它这条内容主要讲${data.variation.angle}，不是单纯堆效果。现在${data.offer}，第一次来的顾客会先做沟通，再开始安排。`,
    },
    {
      title: "发布建议",
      lines: [
        `内容目标：${data.goal}`,
        `语气：${data.tone}`,
        `平台风格：${data.playbook?.style || "真实、专业、可到店转化"}`,
        `优先角度：${data.contentAngles.join(" / ")}`,
        "发布时间：中午 12:00-13:30 或晚上 20:00-22:00",
      ],
    },
  ];
}

function buildImage(data) {
  return [
    {
      title: "图片生成提示词",
      text: `美甲美睫轻医美门店真实案例海报，主题为${data.serviceName}，服务类型包含${data.categoryNames.join("、")}，干净明亮的门店环境，真实顾客护理氛围，自然光线，突出${data.sellingPoints.join("、")}，画面专业可信，不夸张，不过度磨皮，不出现医疗承诺。`,
    },
    {
      title: "海报文案",
      lines: [`${data.serviceName}`, "显白 · 干净 · 日常高级", data.offer, "预约到店，先沟通再设计"],
    },
    {
      title: "版式建议",
      text: "主图占 70%，价格和活动放在底部信息区。左上角放门店名，右下角放预约二维码。美甲用细节近景，美睫用眼型前后状态，皮肤管理和轻医美用环境、沟通、仪器局部和注意事项，不做夸大对比。",
    },
  ];
}

function buildVideo(data) {
  return [
    {
      title: "15 秒短视频脚本",
      lines: [
        `0-3 秒：${data.variation.hook}`,
        `3-8 秒：拍${data.variation.angle}相关细节，字幕：${data.serviceName}`,
        `8-12 秒：展示${data.variation.visualFocus}，镜头拉近看质感`,
        `12-15 秒：${data.variation.cta}。字幕：${data.offer}`,
      ],
    },
    {
      title: "拍摄清单",
      lines: data.serviceProfile?.shootingAngles?.length ? data.serviceProfile.shootingAngles : [
        "门店门头 1 条",
        `项目细节：${data.categoryNames.join("、")} 3 条`,
        "完成特写 2 条",
        "员工沟通和护理提醒 1 条",
        "客户自然反馈或局部对比 1 条",
      ],
    },
    {
      title: "视频生成提示词",
      text: `真实美业门店短视频，展示${data.serviceName}服务流程，干净明亮，镜头稳定，有手部细节、员工操作、完成效果，适合小红书和抖音本地生活引流。`,
    },
  ];
}

function extractPrice(text) {
  return text.match(/\d+\s*元/)?.[0] || "新客价";
}

function buildVariationStrategy(input, serviceProfile, options = {}) {
  const userId = options.user?.id || input.userId || "guest";
  const basis = [
    userId,
    input.contentType,
    input.serviceProfileId || serviceProfile?.id || input.serviceName,
    today(),
    options.generationIndex || 0,
  ].join("|");
  const seed = hashString(basis);
  const category = serviceProfile?.category || "美业";
  const anglePool = collectUnique([
    ...(serviceProfile?.sellingPoints || []),
    "适合人群",
    "真实案例",
    "新手避坑",
    "护理注意事项",
    "到店体验",
    "拍照出片",
    "午休快速变美",
  ]);
  const audiences = collectUnique([
    ...(serviceProfile?.suitableFor || []),
    "第一次到店的新客",
    "忙碌上班族",
    "想自然变精致的顾客",
    "附近想做本地探店的顾客",
  ]);
  const scenes = [
    "午休时间",
    "下班后",
    "周末约会前",
    "换季护理时",
    "拍照出片前",
    "重要见面前",
  ];
  const hooks = [
    `别再只问${category}多少钱了`,
    "想自然变精致，可以先看这一条",
    "这类项目最怕选错风格",
    "附近姐妹来之前先看这个",
    "不是越夸张越好看",
    "适合新手的一套到店思路",
  ];
  const openings = [
    "今天不讲夸张效果，讲一个更适合日常到店的选择",
    "很多顾客第一次来，其实最怕的是做完不适合自己",
    "同一个项目，不同人做出来好不好看，关键在前期沟通",
    "这条适合想变精致但不想太高调的顾客",
  ];
  const visualFocuses = collectUnique([
    ...(serviceProfile?.shootingAngles || []),
    "完成后自然光状态",
    "操作过程细节",
    "员工沟通画面",
    "局部质感近景",
  ]);
  const ctas = [
    "想做同款可以私信发参考图，我们先帮你判断适不适合",
    "不确定适合哪种风格，可以到店先沟通再决定",
    "附近顾客可以先预约时间，避免到店等待",
    "想要自然一点的效果，可以把你的日常妆容和习惯告诉我们",
  ];
  const voices = ["真实种草", "专业科普", "员工经验分享", "新客避坑", "案例复盘"];

  return {
    seed,
    angle: pick(anglePool, seed),
    audience: pick(audiences, seed + 1),
    scene: pick(scenes, seed + 2),
    hook: pick(hooks, seed + 3),
    opening: pick(openings, seed + 4),
    visualFocus: pick(visualFocuses, seed + 5),
    cta: pick(ctas, seed + 6),
    voice: pick(voices, seed + 7),
  };
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pick(items, seed) {
  const list = items.filter(Boolean);
  return list[seed % list.length] || "";
}

function inferPlatform(contentType) {
  return {
    xhs: "xhs",
    copy: "moments",
    image: "xhs",
    video: "douyin",
  }[contentType] || "xhs";
}

function identifyServiceCategories(data, domain) {
  const haystack = `${data.serviceName} ${data.offer} ${data.goal} ${data.storeFeature}`.toLowerCase();
  const matches = Object.values(domain.serviceCategories).filter((category) =>
    category.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())),
  );
  if (matches.length) return matches;
  return [
    domain.serviceCategories.nail,
    domain.serviceCategories.lash,
    domain.serviceCategories.skin,
  ];
}

function buildComplianceNotes(data, domain, serviceMatches) {
  const text = `${data.serviceName} ${data.offer} ${data.storeFeature}`;
  const notes = domain.complianceRules.blockedClaims
    .filter((claim) => text.includes(claim))
    .map((claim) => `检测到绝对化表达「${claim}」，建议改为「${domain.complianceRules.saferAlternatives[claim] || "因个人情况不同"}」。`);
  if (serviceMatches.some((match) => match.name === "轻医美")) {
    notes.push(...domain.complianceRules.lightMedicalRequiredReminders);
  }
  if (!notes.length) {
    notes.push("未检测到高风险承诺，仍建议发布前确认项目资质、价格和适合人群。");
  }
  return collectUnique(notes);
}

function buildVerticalAuditBlock(modelMeta) {
  return {
    title: "垂直模型识别",
    lines: [
      `模型类型：${modelMeta.modelType}`,
      `行业领域：${modelMeta.domain}`,
      `识别项目：${modelMeta.serviceCategories.join("、")}`,
      `平台打法：${modelMeta.platformName}`,
      `知识包版本：${modelMeta.domainVersion}`,
    ],
  };
}

function buildComplianceBlock(notes) {
  return {
    title: "专业与合规检查",
    lines: notes,
  };
}

function buildVariationBlock(variation) {
  return {
    title: "差异化生成策略",
    lines: [
      `内容角度：${variation.angle}`,
      `目标人群：${variation.audience}`,
      `使用场景：${variation.scene}`,
      `视觉重点：${variation.visualFocus}`,
      `表达口吻：${variation.voice}`,
      "同项目再次生成会自动切换角度，避免员工之间内容撞稿。",
    ],
  };
}

function buildServiceProfileBlock(serviceProfile) {
  if (!serviceProfile) return null;
  return {
    title: "已引用门店项目素材",
    lines: [
      `项目：${serviceProfile.name}`,
      `类别：${serviceProfile.category}`,
      `价格：${serviceProfile.price}`,
      `时长：${serviceProfile.duration}`,
      `适合人群：${formatList(serviceProfile.suitableFor)}`,
      `注意事项：${formatList(serviceProfile.cautions)}`,
      `禁忌提醒：${formatList(serviceProfile.contraindications)}`,
      `护理后建议：${formatList(serviceProfile.aftercare)}`,
      `加购建议：${formatList(serviceProfile.upsellSuggestions)}`,
      `拍摄角度：${formatList(serviceProfile.shootingAngles)}`,
    ],
  };
}

function buildEmployeeProfileBlock(employeeProfile) {
  if (!employeeProfile) return null;
  return {
    title: "员工擅长风格",
    lines: [
      `员工：${employeeProfile.name}`,
      `擅长：${formatList(employeeProfile.specialties)}`,
      `内容人格：${employeeProfile.contentPersona || employeeProfile.focus}`,
    ],
  };
}

function buildAssetReferenceBlock(assets = []) {
  if (!assets.length) return null;
  return {
    title: "已引用门店内容素材",
    lines: assets.map((asset) => `${asset.title}：${asset.usageNotes}`).slice(0, 6),
  };
}

async function tryGenerateWithExternalModel(context) {
  const provider = getConfiguredProvider();
  if (!provider) return context.localBlocks;

  const prompt = buildExternalPrompt(context);
  try {
    const text = await callExternalProvider(provider, prompt);
    const blocks = parseModelBlocks(text);
    if (!blocks.length) return context.localBlocks;
    return [
      {
        title: "真实模型生成来源",
        lines: [`服务商：${provider.name}`, `模型：${provider.model}`, "垂直知识包：已注入美甲美睫轻医美规则"],
      },
      ...blocks,
    ];
  } catch (error) {
    return [
      {
        title: "真实模型调用状态",
        lines: [`${provider.name} 调用失败，已回退本地垂直模板。`, `原因：${error.message}`],
      },
      ...context.localBlocks,
    ];
  }
}

function getConfiguredProvider() {
  if (process.env.OPENROUTER_API_KEY) {
    return {
      name: "OpenRouter",
      model: process.env.OPENROUTER_MODEL || "google/gemma-3n-e4b-it:free",
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: process.env.OPENROUTER_API_KEY,
    };
  }
  if (process.env.GEMINI_API_KEY) {
    return {
      name: "Gemini",
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || "gemini-2.0-flash"}:generateContent`,
      apiKey: process.env.GEMINI_API_KEY,
    };
  }
  if (process.env.GROQ_API_KEY) {
    return {
      name: "Groq",
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: process.env.GROQ_API_KEY,
    };
  }
  return null;
}

async function callExternalProvider(provider, prompt) {
  if (provider.name === "Gemini") {
    const response = await fetch(`${provider.endpoint}?key=${provider.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Gemini API 请求失败");
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${provider.apiKey}`,
  };
  if (provider.name === "OpenRouter") {
    headers["HTTP-Referer"] = "http://localhost:4173";
    headers["X-Title"] = "Meiye AI Assistant";
  }
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: "你是美甲、美睫、皮肤管理、轻医美门店的专业自媒体运营模型。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `${provider.name} API 请求失败`);
  return data.choices?.[0]?.message?.content || "";
}

function buildExternalPrompt({ input, data, domain, modelMeta, variation }) {
  const payload = {
    task: "生成美甲美睫轻医美门店自媒体内容",
    outputFormat: "只输出 JSON 数组，每项包含 title 和 text 或 lines 字段，不要输出 Markdown。",
    contentType: input.contentType,
    platform: modelMeta.platformName,
    modelType: modelMeta.modelType,
    domainVersion: modelMeta.domainVersion,
    project: {
      name: data.serviceName,
      offer: data.offer,
      duration: data.serviceProfile?.duration,
      category: data.serviceProfile?.category,
      suitableFor: data.serviceProfile?.suitableFor,
      sellingPoints: data.serviceProfile?.sellingPoints || data.sellingPoints,
      cautions: data.serviceProfile?.cautions,
      contraindications: data.serviceProfile?.contraindications,
      aftercare: data.serviceProfile?.aftercare,
      upsellSuggestions: data.serviceProfile?.upsellSuggestions,
      shootingAngles: data.serviceProfile?.shootingAngles,
      caseNotes: data.serviceProfile?.caseNotes,
    },
    employeeStyle: {
      name: data.employeeProfile?.name,
      specialties: data.employeeProfile?.specialties,
      persona: data.employeeProfile?.contentPersona,
    },
    storeAssets: data.relatedAssets,
    storeFeature: data.storeFeature,
    goal: data.goal,
    tone: data.tone,
    playbook: data.playbook,
    antiDuplication: {
      instruction: "即使项目素材相似，也必须生成和其他员工不同的内容。不要复用固定标题、固定开头或固定分镜。",
      variation,
      mustDifferBy: ["标题钩子", "内容角度", "目标人群", "场景", "CTA", "拍摄重点"],
    },
    compliance: domain.complianceRules,
    requiredChecks: domain.qualityChecklist,
  };
  return JSON.stringify(payload, null, 2);
}

function parseModelBlocks(text) {
  const raw = String(text || "").trim();
  const jsonText = raw.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((block) => block && block.title && (block.text || Array.isArray(block.lines)))
      .map((block) => ({
        title: clean(block.title),
        text: block.text ? clean(block.text) : undefined,
        lines: Array.isArray(block.lines) ? block.lines.map(clean).filter(Boolean).slice(0, 12) : undefined,
      }));
  } catch {
    return [];
  }
}

function formatList(items) {
  if (!Array.isArray(items)) return "";
  return items.filter(Boolean).join("、");
}

function buildVerticalModelInfo() {
  const domain = readDomain();
  const configuredProvider = getConfiguredProvider();
  return {
    version: domain.version,
    positioning: domain.positioning,
    principles: domain.verticalModelPrinciples,
    serviceCategories: domain.serviceCategories,
    platformPlaybooks: domain.platformPlaybooks,
    complianceRules: domain.complianceRules,
    qualityChecklist: domain.qualityChecklist,
    providerRouting: domain.providerRouting,
    runtimeProvider: configuredProvider
      ? {
          configured: true,
          name: configuredProvider.name,
          model: configuredProvider.model,
        }
      : {
          configured: false,
          name: "本地美业垂直模板",
          model: "beauty-domain-local",
        },
  };
}

function getModelType(contentType, domain) {
  if (contentType === "image") return domain.providerRouting.image.modelType;
  if (contentType === "video") return domain.providerRouting.video.modelType;
  return domain.providerRouting.copy.modelType;
}

function getModelDomain(contentType, domain) {
  if (contentType === "image") return domain.providerRouting.image.domain;
  if (contentType === "video") return domain.providerRouting.video.domain;
  return domain.providerRouting.copy.domain;
}

function collectUnique(items) {
  return [...new Set(items.filter(Boolean))];
}

module.exports = {
  applySubscriptionPlan,
  buildBackupExport,
  buildBillingState,
  buildHealthState,
  buildState,
  buildVerticalModelInfo,
  createEmployeeAccount,
  createPasswordHash,
  generateContent,
  generateContentBlocks,
  getUserBySessionToken,
  loginWithPassword,
  normalizeAsset,
  normalizeService,
  normalizeTasks,
  platformNames,
  readDb,
  registerBossAccount,
  validateImportedDb,
  verifyPassword,
};
