// POST /api/admin/chapters/reindex — 为「插入到指定章节之后」腾出 sort_order 空间
// body: { book_id, after_chapter_id?, count }
// 返回 base_order：调用方应把新章节写到 base_order + 1 ... base_order + count
import { checkAdmin, parseJsonBody, checkBookOwnership, validateId, shiftFollowingChapters } from '../../_utils.js';

const MAX_COUNT = 500;

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

  const { book_id, after_chapter_id, count } = body;
  if (!book_id || !validateId(String(book_id))) {
    return Response.json({ error: 'Valid book_id is required' }, { status: 400 });
  }
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1 || n > MAX_COUNT) {
    return Response.json({ error: `count must be an integer between 1 and ${MAX_COUNT}` }, { status: 400 });
  }

  const book = await env.DB.prepare('SELECT id FROM books WHERE id = ?').bind(book_id).first();
  if (!book) return Response.json({ error: 'Book not found' }, { status: 404 });

  if (!await checkBookOwnership(auth, env, book_id)) {
    return Response.json({ error: '只能操作自己书籍的章节' }, { status: 403 });
  }

  let baseOrder = 0;
  const hasAfter = after_chapter_id !== undefined && after_chapter_id !== null && after_chapter_id !== '';
  if (hasAfter) {
    if (!validateId(String(after_chapter_id))) {
      return Response.json({ error: 'Invalid after_chapter_id' }, { status: 400 });
    }
    const afterChapter = await env.DB.prepare('SELECT id, book_id, sort_order FROM chapters WHERE id = ?')
      .bind(after_chapter_id).first();
    if (!afterChapter) return Response.json({ error: 'Chapter not found' }, { status: 404 });
    if (afterChapter.book_id !== Number(book_id)) {
      return Response.json({ error: '该章节不属于这本书' }, { status: 400 });
    }
    baseOrder = Number(afterChapter.sort_order) || 0;
  } else {
    // 追加模式：不改动已有章节，返回当前最大 sort_order
    const last = await env.DB.prepare('SELECT MAX(sort_order) as max_order FROM chapters WHERE book_id = ?')
      .bind(book_id).first();
    return Response.json({ success: true, base_order: Number(last?.max_order) || 0, shifted: 0 });
  }

  const shifted = await shiftFollowingChapters(env, book_id, baseOrder, n);
  if (shifted instanceof Error) {
    return Response.json({ error: '调整章节顺序失败：' + shifted.message }, { status: 500 });
  }

  return Response.json({ success: true, base_order: baseOrder, shifted });
}
