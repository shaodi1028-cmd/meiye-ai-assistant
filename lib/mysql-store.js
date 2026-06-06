const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { buildExportPayload, cloneJson, dataError, validateImportPayload } = require("./store-utils");

function createMysqlStore(options = {}) {
  const root = options.root || process.cwd();
  const seedPath = path.resolve(root, options.seedPath || process.env.MEIYE_DB_SEED_PATH || path.join("data", "db.json"));
  const maxBackups = Number(options.maxBackups || process.env.MEIYE_MAX_BACKUPS || 10);
  const stateTable = safeIdentifier(options.stateTable || process.env.MYSQL_STATE_TABLE || "meiye_app_state");
  const backupTable = safeIdentifier(options.backupTable || process.env.MYSQL_BACKUP_TABLE || "meiye_backups");
  const pool = mysql.createPool({
    host: options.host || process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(options.port || process.env.MYSQL_PORT || 3306),
    user: options.user || process.env.MYSQL_USER || "root",
    password: options.password || process.env.MYSQL_PASSWORD || "",
    database: options.database || process.env.MYSQL_DATABASE || "meiye_ai",
    waitForConnections: true,
    connectionLimit: Number(options.connectionLimit || process.env.MYSQL_CONNECTION_LIMIT || 10),
    charset: "utf8mb4",
    timezone: "Z",
  });
  let schemaReady = false;

  async function read() {
    await ensureState();
    const [rows] = await pool.execute(`SELECT data FROM \`${stateTable}\` WHERE id = 1 LIMIT 1`);
    if (!rows.length) {
      dataError("MySQL 数据库尚未初始化", "MYSQL_STATE_NOT_FOUND", 500);
    }
    return normalizeJson(rows[0].data);
  }

  async function write(db) {
    await ensureState();
    const currentDb = await read();
    await createBackup(currentDb, "auto");
    await pool.execute(`UPDATE \`${stateTable}\` SET data = CAST(? AS JSON), updated_at = CURRENT_TIMESTAMP WHERE id = 1`, [
      JSON.stringify(db),
    ]);
  }

  async function resetFromSeed(reason = "before-reset") {
    await ensureSchema();
    const seedDb = readSeed();
    let backupId = "";
    try {
      const currentDb = await read();
      backupId = await createBackup(currentDb, reason);
    } catch {
      backupId = "";
    }
    await pool.execute(
      `INSERT INTO \`${stateTable}\` (id, data) VALUES (1, CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(seedDb)],
    );
    return {
      backupPath: backupId,
      dbPath: `${stateTable}:1`,
      seedPath,
    };
  }

  function buildExport(db) {
    return buildExportPayload(db);
  }

  function validateImport(payload = {}) {
    return validateImportPayload(payload);
  }

  async function createBackup(db, reason = "auto") {
    await ensureSchema();
    const backup = buildExport(db);
    const serialized = JSON.stringify(backup);
    const [result] = await pool.execute(
      `INSERT INTO \`${backupTable}\` (reason, data, size_bytes) VALUES (?, CAST(? AS JSON), ?)`,
      [reason, serialized, Buffer.byteLength(serialized)],
    );
    await pruneBackups();
    return `mysql-backup-${result.insertId}`;
  }

  async function listBackups() {
    await ensureSchema();
    const [rows] = await pool.execute(
      `SELECT id, reason, size_bytes AS size, created_at AS createdAt
       FROM \`${backupTable}\`
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      [maxBackups],
    );
    return rows.map((row) => ({
      fileName: `mysql-backup-${row.id}-${row.reason}.json`,
      size: Number(row.size || 0),
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  }

  async function health() {
    try {
      await ensureSchema();
      const [rows] = await pool.execute(`SELECT COUNT(*) AS count FROM \`${stateTable}\` WHERE id = 1`);
      return {
        type: "mysql",
        ready: Number(rows[0]?.count || 0) > 0,
        host: process.env.MYSQL_HOST || "127.0.0.1",
        port: Number(process.env.MYSQL_PORT || 3306),
        database: process.env.MYSQL_DATABASE || "meiye_ai",
        stateTable,
        backupTable,
      };
    } catch (error) {
      return {
        type: "mysql",
        ready: false,
        error: error.message,
        host: process.env.MYSQL_HOST || "127.0.0.1",
        port: Number(process.env.MYSQL_PORT || 3306),
        database: process.env.MYSQL_DATABASE || "meiye_ai",
        stateTable,
        backupTable,
      };
    }
  }

  async function ensureState() {
    await ensureSchema();
    const [rows] = await pool.execute(`SELECT id FROM \`${stateTable}\` WHERE id = 1 LIMIT 1`);
    if (rows.length) return;
    const seedDb = readSeed();
    await pool.execute(`INSERT INTO \`${stateTable}\` (id, data) VALUES (1, CAST(? AS JSON))`, [JSON.stringify(seedDb)]);
  }

  async function ensureSchema() {
    if (schemaReady) return;
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS \`${stateTable}\` (
        id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
        data JSON NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS \`${backupTable}\` (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        reason VARCHAR(64) NOT NULL DEFAULT 'auto',
        data JSON NOT NULL,
        size_bytes INT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    schemaReady = true;
  }

  async function pruneBackups() {
    const [rows] = await pool.execute(`SELECT id FROM \`${backupTable}\` ORDER BY created_at DESC, id DESC`);
    const staleRows = rows.slice(maxBackups);
    if (!staleRows.length) return;
    await pool.query(`DELETE FROM \`${backupTable}\` WHERE id IN (?)`, [staleRows.map((row) => row.id)]);
  }

  function readSeed() {
    if (!fs.existsSync(seedPath)) {
      dataError(`初始化数据文件不存在：${seedPath}`, "SEED_NOT_FOUND", 500);
    }
    return JSON.parse(fs.readFileSync(seedPath, "utf8"));
  }

  async function close() {
    await pool.end();
  }

  return {
    buildExport,
    close,
    createBackup,
    health,
    listBackups,
    read,
    resetFromSeed,
    validateImport,
    write,
  };
}

function normalizeJson(value) {
  if (typeof value === "string") return JSON.parse(value);
  return cloneJson(value);
}

function safeIdentifier(value) {
  const identifier = String(value || "");
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    dataError(`MySQL 表名不合法：${identifier}`, "INVALID_MYSQL_IDENTIFIER", 500);
  }
  return identifier;
}

module.exports = {
  createMysqlStore,
};
