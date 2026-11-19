-- Rollback for Migration 001: 访问统计 + 多管理员角色
-- ⚠️ 警告：这将删除所有统计数据，不可恢复！
-- 执行前请做好数据备份

-- 删除统计相关表
DROP TABLE IF EXISTS chapter_stats;
DROP TABLE IF EXISTS book_stats;
DROP TABLE IF EXISTS daily_visitors;
DROP TABLE IF EXISTS site_visits;

-- 移除 role 字段（SQLite不支持 DROP COLUMN，需重建表）
-- ⚠️ 此操作会丢失所有 role 数据
CREATE TABLE IF NOT EXISTS admin_users_rollback_001 AS
  SELECT id, username, password_hash, created_at, updated_at
  FROM admin_users;

DROP TABLE admin_users;
ALTER TABLE admin_users_rollback_001 RENAME TO admin_users;

-- 重建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
