const fs = require("fs");
const path = require("path");
const { createMysqlStore } = require("../lib/mysql-store");
const { validateImportPayload } = require("../lib/store-utils");

async function main() {
  const root = path.join(__dirname, "..");
  const sourcePath = path.resolve(root, process.argv[2] || process.env.MEIYE_DB_SEED_PATH || path.join("data", "db.json"));
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`导入文件不存在：${sourcePath}`);
  }
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const db = validateImportPayload(source);
  const store = createMysqlStore({ root });
  await store.write(db);
  const health = await store.health();
  await store.close();
  console.log("JSON 数据已导入 MySQL。");
  console.log(`来源：${path.relative(root, sourcePath)}`);
  console.log(`数据库：${health.database}`);
  console.log(`状态表：${health.stateTable}`);
  console.log(`备份表：${health.backupTable}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
