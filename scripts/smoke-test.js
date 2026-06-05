const assert = require("assert");
const {
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
  readDb,
  registerBossAccount,
  validateImportedDb,
  verifyPassword,
} = require("../server");

async function main() {
  const db = readDb();

  const bossState = buildState(db, db.users.boss);
  assert.strictEqual(Object.keys(bossState.employees).length >= 4, true);
  assert.strictEqual(Object.keys(bossState.services).length >= 4, true);
  assert.strictEqual(bossState.user.role, "boss");

  const employeeState = buildState(db, db.users.chen);
  assert.deepStrictEqual(Object.keys(employeeState.employees), ["chen"]);
  assert.strictEqual(employeeState.user.role, "employee");

  assert.deepStrictEqual(normalizeTasks({ xhs: "2", douyin: "-1", moments: "99" }), {
    xhs: 2,
    douyin: 0,
    moments: 20,
  });

  const service = normalizeService({
    category: "美睫",
    name: "测试自然美睫",
    suitableFor: "通勤顾客\n素颜顾客",
    sellingPoints: "自然, 不厚重",
    cautions: "敏感眼先沟通、避免揉眼",
    contraindications: "眼部不适先沟通",
    aftercare: "6 小时内避免碰水",
    upsellSuggestions: "搭配皮肤补水",
    shootingAngles: "闭眼近景；睁眼自然光",
  });
  assert.deepStrictEqual(service.suitableFor, ["通勤顾客", "素颜顾客"]);
  assert.deepStrictEqual(service.sellingPoints, ["自然", "不厚重"]);
  assert.deepStrictEqual(service.cautions, ["敏感眼先沟通", "避免揉眼"]);
  assert.deepStrictEqual(service.aftercare, ["6 小时内避免碰水"]);

  const asset = normalizeAsset(
    {
      serviceId: "svc_nail_ice",
      employeeId: "chen",
      title: "测试案例图",
      tags: "显白, 通勤",
      usageNotes: "适合封面",
    },
    db,
  );
  assert.deepStrictEqual(asset.tags, ["显白", "通勤"]);
  assert.strictEqual(asset.serviceId, "svc_nail_ice");

  const billingDb = JSON.parse(JSON.stringify(db));
  applySubscriptionPlan(billingDb, "starter");
  const billing = buildBillingState(billingDb);
  assert.strictEqual(billing.quota, 300);
  assert.strictEqual(billing.subscription.planName, "单店基础版");

  const blocks = await generateContentBlocks(
    {
      contentType: "video",
      serviceName: "冰透显白美甲",
      offer: "新客 168 元",
      goal: "引流到店",
      tone: "真实种草",
      storeFeature: "美甲、美睫、皮肤管理可以一次安排。",
    },
    db.services.svc_nail_ice,
  );

  assert.strictEqual(Array.isArray(blocks), true);
  assert.strictEqual(blocks.length > 0, true);
  assert.strictEqual(blocks.some((block) => block.title.includes("项目素材")), true);

  const modelInfo = buildVerticalModelInfo();
  assert.strictEqual(modelInfo.positioning.includes("美甲美睫"), true);
  assert.strictEqual(Object.keys(modelInfo.serviceCategories).includes("lightMedical"), true);
  assert.strictEqual(typeof modelInfo.runtimeProvider.configured, "boolean");

  const health = buildHealthState();
  assert.strictEqual(health.ok, true);
  assert.strictEqual(health.service, "meiye-ai-assistant");
  assert.strictEqual(health.storage.ready, true);

  const passwordHash = createPasswordHash("test123456");
  assert.strictEqual(verifyPassword("test123456", passwordHash), true);
  assert.strictEqual(verifyPassword("bad-password", passwordHash), false);

  const authDb = JSON.parse(JSON.stringify(db));
  const registered = registerBossAccount(authDb, {
    storeName: "测试美业门店",
    name: "测试老板",
    phone: "13800000000",
    password: "test123456",
  });
  assert.strictEqual(registered.user.role, "boss");
  assert.strictEqual(authDb.store.name, "测试美业门店");
  assert.strictEqual(typeof registered.token, "string");
  assert.strictEqual(getUserBySessionToken(authDb, registered.token).id, registered.user.id);

  const loggedIn = loginWithPassword(authDb, {
    phone: "13800000000",
    password: "test123456",
  });
  assert.strictEqual(loggedIn.user.id, registered.user.id);

  const createdEmployee = createEmployeeAccount(authDb, {
    name: "测试员工",
    role: "美甲师",
    focus: "测试内容方向",
    phone: "13900000000",
    password: "emp123456",
  });
  assert.strictEqual(createdEmployee.employee.role, "美甲师");
  assert.deepStrictEqual(createdEmployee.employeeLogin, {
    phone: "13900000000",
    password: "emp123456",
  });
  const employeeLogin = loginWithPassword(authDb, {
    phone: "13900000000",
    password: "emp123456",
  });
  assert.strictEqual(employeeLogin.user.role, "employee");
  assert.throws(() => createEmployeeAccount(authDb, { name: "", phone: "13900000001" }), /员工姓名不能为空/);
  assert.throws(
    () => createEmployeeAccount(authDb, { name: "弱密码员工", phone: "13900000001", password: "123" }),
    /员工初始密码至少需要 6 位/,
  );
  assert.throws(
    () => createEmployeeAccount(authDb, { name: "重复手机号员工", phone: "13900000000", password: "emp123456" }),
    /这个手机号已经注册过/,
  );

  const backup = buildBackupExport(authDb);
  assert.strictEqual(backup.app, "meiye-ai-assistant");
  assert.deepStrictEqual(backup.data.auth.sessions, {});
  assert.strictEqual(validateImportedDb(backup).store.name, "测试美业门店");
  assert.throws(() => validateImportedDb({ bad: true }), /备份缺少/);

  const lightMedicalGeneration = await generateContent(
    {
      contentType: "xhs",
      serviceName: "轻医美水光护理",
      offer: "新客体验价 399 元",
      goal: "引流到店",
      tone: "专业可信",
      storeFeature: "到店先做专业沟通，不承诺百分百改善。",
    },
    db.services.svc_lightmedical_aqua,
  );
  assert.strictEqual(lightMedicalGeneration.modelMeta.vertical, true);
  assert.strictEqual(lightMedicalGeneration.modelMeta.serviceCategories.includes("轻医美"), true);
  assert.strictEqual(lightMedicalGeneration.modelMeta.complianceNotes.some((note) => note.includes("轻医美")), true);

  const firstVariant = await generateContent(
    { contentType: "xhs", serviceName: "夏日显白冰透美甲套餐", offer: "新客 168 元" },
    db.services.svc_nail_ice,
    { user: db.users.chen, generationIndex: 1 },
  );
  const secondVariant = await generateContent(
    { contentType: "xhs", serviceName: "夏日显白冰透美甲套餐", offer: "新客 168 元" },
    db.services.svc_nail_ice,
    { user: db.users.lin, generationIndex: 2 },
  );
  const firstStrategy = firstVariant.blocks.find((block) => block.title === "差异化生成策略");
  const secondStrategy = secondVariant.blocks.find((block) => block.title === "差异化生成策略");
  assert.notDeepStrictEqual(firstStrategy.lines.slice(0, 5), secondStrategy.lines.slice(0, 5));

  console.log("smoke test ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
