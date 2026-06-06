# 部署说明

这份说明用于把当前本地 MVP 部署到一台 Node.js 服务器或支持 Node 的云平台。

## 运行要求

- Node.js 20 或以上
- 可写的数据目录，或一个 MySQL 8 数据库
- 至少一个可选 AI 模型 API Key

## 启动命令

```bash
npm run start
```

本地开发仍然使用：

```bash
npm run dev
```

## Docker 启动

本地或服务器安装 Docker 后可以直接运行：

```bash
docker compose up --build
```

默认访问：

```text
http://localhost:4173
```

`docker-compose.yml` 会同时启动应用和 MySQL 8。本地默认访问应用：

```text
http://localhost:4173
```

MySQL 数据会保存到 `meiye-mysql` volume。应用仍保留 `/data` volume，用于兼容 JSON seed 和未来文件类数据。

## 环境变量

```bash
NODE_ENV=production
HOST=0.0.0.0
PORT=4173
MEIYE_STORE=mysql
MEIYE_DB_PATH=/data/db.json
MEIYE_DB_SEED_PATH=/app/data/db.json
MEIYE_BACKUP_DIR=/data/backups
MEIYE_MAX_BACKUPS=10
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_DATABASE=meiye_ai
MYSQL_USER=meiye_user
MYSQL_PASSWORD=meiye_password
```

`MEIYE_STORE` 支持两个值：

- `json`：继续使用本地 JSON 文件，适合演示和单机试用。
- `mysql`：使用 MySQL 数据层，适合真实门店内测和云部署。

`MEIYE_DB_PATH` 是 JSON 数据库的路径。使用 `MEIYE_STORE=json` 时，建议把它放到云平台的持久化磁盘目录，否则服务重启或重新部署后，员工提交、项目素材、生成记录可能丢失。

`MEIYE_DB_SEED_PATH` 是首次启动时复制初始数据的路径。当 `MEIYE_DB_PATH` 不存在时，系统会自动从 seed 文件初始化一份数据库，适合空 Docker volume 或新挂载磁盘。

使用 `MEIYE_STORE=mysql` 时，系统会自动创建 `meiye_app_state` 和 `meiye_backups` 两张表。如果 MySQL 状态表为空，系统会从 `MEIYE_DB_SEED_PATH` 读取初始演示数据并写入 MySQL。

`MEIYE_BACKUP_DIR` 用于保存 JSON 自动备份。使用 MySQL 时，自动备份保存在 `meiye_backups` 表里。老板也可以在产品里的“数据备份”页面导出当前完整数据，或粘贴备份 JSON 进行恢复。

## MySQL 本地运行

启动 MySQL 和应用：

```bash
docker compose up --build
```

如果只想在本机已有 MySQL 中导入演示数据：

```bash
MEIYE_STORE=mysql \
MYSQL_HOST=127.0.0.1 \
MYSQL_PORT=3306 \
MYSQL_DATABASE=meiye_ai \
MYSQL_USER=meiye_user \
MYSQL_PASSWORD=meiye_password \
npm run mysql:import
```

MySQL schema 参考：

```text
db/mysql-schema.sql
```

## 数据层边界

当前数据访问集中在 `lib/store.js`。业务接口不直接管理 JSON 路径、MySQL 连接、备份目录或导入导出格式，而是保持 `read`、`write`、`buildExport`、`validateImport`、`listBackups` 等边界稳定。

当前 MySQL 版本采用兼容型文档存储：`meiye_app_state` 保存完整应用状态，`meiye_backups` 保存自动备份。这样可以最快把产品迁到云数据库。等真实门店流程稳定后，可以继续把门店、用户、员工任务、素材、生成记录拆成独立关系表。

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
- 多租户关系表：门店、用户、任务、素材、生成记录拆表
- 文件上传：案例图、门店素材、员工截图
- 支付订阅：套餐、订单、额度流水
- 管理后台：门店、用户、套餐、生成记录
- 日志和错误监控
