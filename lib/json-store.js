const fs = require("fs");
const path = require("path");

function createJsonStore(options = {}) {
  const root = options.root || process.cwd();
  const dbPath = path.resolve(root, options.dbPath || process.env.MEIYE_DB_PATH || path.join("data", "db.json"));
  const seedPath = path.resolve(root, options.seedPath || process.env.MEIYE_DB_SEED_PATH || path.join("data", "db.json"));
  const backupDir = path.resolve(root, options.backupDir || process.env.MEIYE_BACKUP_DIR || path.join("data", "backups"));
  const maxBackups = Number(options.maxBackups || process.env.MEIYE_MAX_BACKUPS || 10);

  function read() {
    ensureDb();
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  }

  function write(db) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    if (fs.existsSync(dbPath)) {
      createBackup(read(), "auto");
    }
    fs.writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`);
  }

  function buildExport(db) {
    const auth = db.auth
      ? {
          accounts: db.auth.accounts || {},
          sessions: {},
        }
      : undefined;
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: "meiye-ai-assistant",
      data: auth ? { ...db, auth } : db,
    };
  }

  function validateImport(payload = {}) {
    const candidate = payload.data && payload.app === "meiye-ai-assistant" ? payload.data : payload;
    if (!candidate || typeof candidate !== "object") {
      dataError("备份格式不正确", "INVALID_BACKUP");
    }
    const requiredKeys = ["store", "users", "employees", "services", "submissions", "generations", "assets"];
    requiredKeys.forEach((key) => {
      if (!(key in candidate)) {
        dataError(`备份缺少 ${key} 字段`, "INVALID_BACKUP");
      }
    });
    return JSON.parse(JSON.stringify(candidate));
  }

  function createBackup(db, reason = "auto") {
    fs.mkdirSync(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${timestamp}-${reason}.json`;
    const backupPath = path.join(backupDir, fileName);
    fs.writeFileSync(backupPath, `${JSON.stringify(buildExport(db), null, 2)}\n`);
    pruneBackups();
    return backupPath;
  }

  function listBackups() {
    if (!fs.existsSync(backupDir)) return [];
    return fs
      .readdirSync(backupDir)
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => {
        const backupPath = path.join(backupDir, fileName);
        const stat = fs.statSync(backupPath);
        return {
          fileName,
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function pruneBackups() {
    const backups = listBackups();
    backups.slice(maxBackups).forEach((backup) => {
      fs.unlinkSync(path.join(backupDir, backup.fileName));
    });
  }

  function health() {
    return {
      type: "json",
      path: path.relative(root, dbPath),
      ready: fs.existsSync(dbPath),
      seedPath: path.relative(root, seedPath),
      backupDir: path.relative(root, backupDir),
    };
  }

  function ensureDb() {
    if (fs.existsSync(dbPath)) return;
    if (!fs.existsSync(seedPath)) {
      dataError(`数据库文件不存在：${dbPath}`, "DB_NOT_FOUND", 500);
    }
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.copyFileSync(seedPath, dbPath);
  }

  return {
    buildExport,
    createBackup,
    health,
    listBackups,
    read,
    validateImport,
    write,
  };
}

function dataError(message, code, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  throw error;
}

module.exports = {
  createJsonStore,
};
