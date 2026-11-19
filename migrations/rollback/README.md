# 迁移回滚脚本

这些脚本用于回滚数据库迁移。

> ⚠️ **警告**：回滚操作通常会导致数据丢失，执行前必须完整备份数据库！

## 使用方法

```bash
# 执行前先备份
wrangler d1 export novel-db --remote > backup_$(date +%Y%m%d_%H%M%S).sql

# 回滚指定迁移（按逆序执行）
wrangler d1 execute novel-db --file migrations/rollback/003_rollback.sql --remote
wrangler d1 execute novel-db --file migrations/rollback/002_rollback.sql --remote
wrangler d1 execute novel-db --file migrations/rollback/001_rollback.sql --remote
```

## 注意事项

1. SQLite（D1）不支持 `ALTER TABLE DROP COLUMN`，回滚通过重建表实现
2. 重建表会丢失所有外键约束（需手动重建）
3. 回滚脚本仅适用于全量回滚，不支持部分回滚
4. 生产环境回滚前务必在测试环境验证
