# 部署说明

这份说明用于把当前本地 MVP 部署到一台 Node.js 服务器或支持 Node 的云平台。

## 运行要求

- Node.js 20 或以上
- 可写的数据目录
- 至少一个可选 AI 模型 API Key

## 启动命令

```bash
npm run start
```

本地开发仍然使用：

```bash
npm run dev
```

## 环境变量

```bash
NODE_ENV=production
HOST=0.0.0.0
PORT=4173
MEIYE_DB_PATH=/data/db.json
MEIYE_BACKUP_DIR=/data/backups
MEIYE_MAX_BACKUPS=10
```

`MEIYE_DB_PATH` 是当前 JSON 数据库的路径。部署时建议把它放到云平台的持久化磁盘目录，否则服务重启或重新部署后，员工提交、项目素材、生成记录可能丢失。

账号、员工、session、素材库和生成记录当前都保存在这个 JSON 文件里。上线内测时必须保证该路径可写且持久化。

`MEIYE_BACKUP_DIR` 用于保存自动备份。每次后端写入 JSON 数据库前，系统会保存一份备份，默认最多保留 10 份。老板也可以在产品里的“数据备份”页面导出当前完整数据，或粘贴备份 JSON 进行恢复。

## 数据层边界

当前数据访问集中在 `lib/json-store.js`。业务接口不再直接管理 JSON 路径、备份目录或导入导出格式。后续迁移数据库时，优先新增新的 store 实现，并保持 `read`、`write`、`buildExport`、`validateImport`、`listBackups` 等边界稳定。

## AI 模型配置

任选一个即可：

```bash
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemma-3n-e4b-it:free
```

```bash
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
```

```bash
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
```

如果都不配置，系统会使用本地美业垂直模板，仍然可以生成内容和演示完整流程。

## 健康检查

部署平台可以使用：

```text
/healthz
```

或：

```text
/api/health
```

正常返回示例：

```json
{
  "ok": true,
  "service": "meiye-ai-assistant",
  "environment": "production",
  "modelProvider": "local-template"
}
```

## 当前生产化边界

当前版本已经具备部署基础，但还不是正式多租户 SaaS 后端。上线内测前建议继续补：

- 手机验证码、找回密码、门店邀请码
- 正式数据库：PostgreSQL 或 MySQL
- 文件上传：案例图、门店素材、员工截图
- 支付订阅：套餐、订单、额度流水
- 管理后台：门店、用户、套餐、生成记录
- 日志和错误监控
