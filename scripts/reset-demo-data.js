const path = require("path");
const { createJsonStore } = require("../lib/json-store");

const root = path.join(__dirname, "..");
const store = createJsonStore({ root });
const result = store.resetFromSeed("before-reset");

console.log("演示数据已重置。");
console.log(`数据库：${path.relative(root, result.dbPath)}`);
console.log(`初始化数据：${path.relative(root, result.seedPath)}`);
if (result.backupPath) {
  console.log(`重置前备份：${path.relative(root, result.backupPath)}`);
}
