-- Rollback for Migration 002: GitHub OAuth 支持
-- ⚠️ 警告：这将删除所有 GitHub OAuth 关联，不可恢复！
-- 执行前请做好数据备份

-- 删除唯一索引
DROP INDEX IF EXISTS idx_admin_users_github_id_unique;

-- 移除 GitHub 相关字段（SQLite不支持 DROP COLUMN，需重建表）
CREATE TABLE IF NOT EXISTS admin_users_rollback_002 AS
  SELECT id, username, password_hash, role, created_at, updated_at
  FROM admin_users;

DROP TABLE admin_users;
ALTER TABLE admin_users_rollback_002 RENAME TO admin_users;

-- 重建索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
