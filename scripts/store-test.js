const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createJsonStore } = require("../lib/json-store");

function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "meiye-store-"));
  const store = createJsonStore({
    root,
    dbPath: "db.json",
    backupDir: "backups",
    maxBackups: 2,
  });
  const firstDb = {
    store: { name: "测试门店" },
    users: {},
    employees: {},
    services: {},
    submissions: [],
    generations: [],
    assets: {},
    auth: {
      accounts: {},
      sessions: {
        secret: { token: "secret", userId: "boss" },
      },
    },
  };

  store.write(firstDb);
  assert.strictEqual(store.read().store.name, "测试门店");
  assert.strictEqual(store.health().ready, true);

  const secondDb = { ...firstDb, store: { name: "第二次写入" } };
  store.write(secondDb);
  assert.strictEqual(store.read().store.name, "第二次写入");
  assert.strictEqual(store.listBackups().length, 1);

  store.write({ ...firstDb, store: { name: "第三次写入" } });
  store.write({ ...firstDb, store: { name: "第四次写入" } });
  assert.strictEqual(store.listBackups().length, 2);

  const exported = store.buildExport(firstDb);
  assert.deepStrictEqual(exported.data.auth.sessions, {});
  assert.strictEqual(store.validateImport(exported).store.name, "测试门店");
  assert.throws(() => store.validateImport({ bad: true }), /备份缺少/);

  const seedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "meiye-store-seed-"));
  const seedDb = { ...firstDb, store: { name: "种子门店" } };
  fs.writeFileSync(path.join(seedRoot, "seed.json"), `${JSON.stringify(seedDb, null, 2)}\n`);
  const seededStore = createJsonStore({
    root: seedRoot,
    dbPath: "data/db.json",
    seedPath: "seed.json",
    backupDir: "backups",
  });
  assert.strictEqual(seededStore.health().ready, false);
  assert.strictEqual(seededStore.read().store.name, "种子门店");
  assert.strictEqual(seededStore.health().ready, true);

  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(seedRoot, { recursive: true, force: true });
  console.log("store test ok");
}

main();
