-- Rollback for Migration 003: 章节乐观锁版本号
-- ⚠️ 警告：移除 version 字段后，并发编辑保护将失效
-- 执行前请做好数据备份

-- 移除 version 字段（SQLite不支持 DROP COLUMN，需重建表）
CREATE TABLE IF NOT EXISTS chapters_rollback_003 AS
  SELECT id, book_id, title, sort_order, word_count, content_key, created_at, updated_at
  FROM chapters;

DROP TABLE chapters;
ALTER TABLE chapters_rollback_003 RENAME TO chapters;

-- 重建索引
CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_chapters_sort_order ON chapters(book_id, sort_order);
