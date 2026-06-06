const path = require("path");
const { createDataStore } = require("../lib/store");

async function main() {
  const root = path.join(__dirname, "..");
  const store = createDataStore({ root });
  const result = await store.resetFromSeed("before-reset");

  console.log("演示数据已重置。");
  console.log(`数据库：${formatLocation(root, result.dbPath)}`);
  console.log(`初始化数据：${formatLocation(root, result.seedPath)}`);
  if (result.backupPath) {
    console.log(`重置前备份：${formatLocation(root, result.backupPath)}`);
  }
  if (store.close) {
    await store.close();
  }
}

function formatLocation(root, value) {
  if (!value) return "";
  return path.isAbsolute(value) ? path.relative(root, value) : value;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
