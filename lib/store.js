const { createJsonStore } = require("./json-store");
const { createMysqlStore } = require("./mysql-store");

function createDataStore(options = {}) {
  const type = String(options.type || process.env.MEIYE_STORE || "json").toLowerCase();
  if (type === "mysql") {
    return createMysqlStore(options);
  }
  if (type !== "json") {
    const error = new Error(`不支持的数据存储类型：${type}`);
    error.statusCode = 500;
    error.code = "UNSUPPORTED_STORE";
    throw error;
  }
  return createJsonStore(options);
}

module.exports = {
  createDataStore,
};
