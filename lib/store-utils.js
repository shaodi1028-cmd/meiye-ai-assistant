function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildExportPayload(db) {
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

function validateImportPayload(payload = {}) {
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
  return cloneJson(candidate);
}

function dataError(message, code, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  throw error;
}

module.exports = {
  buildExportPayload,
  cloneJson,
  dataError,
  validateImportPayload,
};
