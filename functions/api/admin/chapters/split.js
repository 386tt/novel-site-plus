// POST /api/admin/chapters/split — 把一个章节拆成多章
// body: { chapter_id, parts: [{ title, content }, ...] }  parts[0] 覆盖原章节，其余插在其后
import { checkAdmin, parseJsonBody, checkBookOwnership, validateId, shiftFollowingChapters } from '../../_utils.js';

const MAX_PARTS = 200;
const MAX_CONTENT_LENGTH = 500000;

export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = await checkAdmin(request, env);
  if (!auth.ok) {
    const status = auth.reason === 'locked' ? 429 : 401;
    const msg = auth.reason === 'locked' ? 'Too many failed attempts, try again later' : 'Unauthorized';
    return Response.json({ error: msg }, { status });
  }

  const body = await parseJsonBody(request);
  if (!body) return Response.json({ error: 'Invalid JSON' }, { status: 400 });

  const { chapter_id, parts } = body;
  if (!chapter_id || !validateId(String(chapter_id))) {
    return Response.json({ error: 'Valid chapter_id is required' }, { status: 400 });
  }
  if (!Array.isArray(parts) || parts.length < 2 || parts.length > MAX_PARTS) {
    return Response.json({ error: `parts 必须是 2-${MAX_PARTS} 段` }, { status: 400 });
  }
  for (const p of parts) {
    if (!p || typeof p.title !== 'string' || !p.title.trim()) {
      return Response.json({ error: '每段都需要标题' }, { status: 400 });
    }
    if (p.title.trim().length > 200) {
      return Response.json({ error: '标题过长（最多 200 字）' }, { status: 400 });
    }
    if (typeof p.content !== 'string' || !p.content.trim()) {
      return Response.json({ error: `「${p.title.trim()}」内容为空` }, { status: 400 });
    }
    if (p.content.length > MAX_CONTENT_LENGTH) {
      return Response.json({ error: `「${p.title.trim()}」内容过长（最多 ${MAX_CONTENT_LENGTH} 字）` }, { status: 400 });
    }
  }

  const chapter = await env.DB.prepare('SELECT * FROM chapters WHERE id = ?').bind(chapter_id).first();
  if (!chapter) return Response.json({ error: 'Chapter not found' }, { status: 404 });

  if (!await checkBookOwnership(auth, env, chapter.book_id)) {
    return Response.json({ error: '只能操作自己书籍的章节' }, { status: 403 });
  }

  const bookId = chapter.book_id;
  const baseOrder = Number(chapter.sort_order) || 0;
  const shifts = parts.length - 1;

  const shifted = await shiftFollowingChapters(env, bookId, baseOrder, shifts);
  if (shifted instanceof Error) {
    return Response.json({ error: '调整章节顺序失败：' + shifted.message }, { status: 500 });
  }

  // 第 1 段覆盖原章节：先写 R2，再更新 D1
  const first = parts[0];
  const firstContent = first.content.trim();
  try {
    await env.R2.put(chapter.content_key, firstContent);
  } catch {
    return Response.json({ error: '保存正文失败' }, { status: 500 });
  }
  try {
    await env.DB.prepare(
      "UPDATE chapters SET title = ?, word_count = ?, version = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(first.title.trim(), firstContent.length, (chapter.version || 0) + 1, chapter.id).run();
  } catch {
    return Response.json({ error: '更新章节失败' }, { status: 500 });
  }

  // 其余段落作为新章节插入
  const created = [];
  const failed = [];
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    const content = p.content.trim();
    const sortOrder = baseOrder + i;
    let newId = null;
    try {
      const r = await env.DB.prepare(`
        INSERT INTO chapters (book_id, title, sort_order, word_count, content_key)
        VALUES (?, ?, ?, ?, 'pending')
      `).bind(bookId, p.title.trim(), sortOrder, content.length).run();
      newId = r.meta.last_row_id;
      const contentKey = `novels/books/${bookId}/chapters/${newId}.txt`;
      await env.R2.put(contentKey, content);
      await env.DB.prepare('UPDATE chapters SET content_key = ? WHERE id = ?').bind(contentKey, newId).run();
      created.push({ id: newId, title: p.title.trim(), sort_order: sortOrder });
    } catch (e) {
      if (newId) {
        await env.DB.prepare('DELETE FROM chapters WHERE id = ?').bind(newId).run().catch(() => {});
      }
      failed.push(`${p.title.trim()}: ${e.message}`);
    }
  }

  await env.DB.prepare("UPDATE books SET updated_at = datetime('now') WHERE id = ?").bind(bookId).run();

  return Response.json({
    success: failed.length === 0,
    created,
    failed,
    total: parts.length
  });
}
