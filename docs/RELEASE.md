# 发布包说明

当前项目可以直接生成一份可部署压缩包：

```bash
npm run release:package
```

脚本会先执行 `npm run check`，通过后在 `dist/` 目录生成：

```text
meiye-ai-assistant-0.2.0.tar.gz
```

压缩包不包含 `.git`、`.env`、`node_modules` 和 `data/backups`。部署到服务器后可执行：

```bash
tar -xzf meiye-ai-assistant-0.2.0.tar.gz
cd meiye-ai-assistant
npm run start
```

如果部署平台提供持久化磁盘，建议配置：

```bash
MEIYE_DB_PATH=/data/db.json
MEIYE_DB_SEED_PATH=/app/data/db.json
MEIYE_BACKUP_DIR=/data/backups
```
