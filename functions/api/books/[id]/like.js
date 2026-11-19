import { checkUser, ensureSchema, validateId } from '../../_utils.js';

export async function onRequestPost(context) {
  const { request, env, params } = context;
  if (!validateId(params.id)) return Response.json({ error: 'Invalid book ID' }, { status: 400 });
  const auth = await checkUser(request, env);
  if (!auth.ok) return Response.json({ error: '请先登录后再喜欢书籍' }, { status: 401 });
  await ensureSchema(env);
  const book = await env.DB.prepare("SELECT id FROM books WHERE id = ? AND (status IS NULL OR status = 'normal')").bind(params.id).first();
  if (!book) return Response.json({ error: '书籍不存在' }, { status: 404 });
  const existing = await env.DB.prepare('SELECT 1 FROM book_likes WHERE book_id = ? AND user_id = ?').bind(params.id, auth.userId).first();
  if (existing) {
    await env.DB.prepare('DELETE FROM book_likes WHERE book_id = ? AND user_id = ?').bind(params.id, auth.userId).run();
  } else {
    await env.DB.prepare('INSERT OR IGNORE INTO book_likes (book_id, user_id) VALUES (?, ?)').bind(params.id, auth.userId).run();
  }
  const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM book_likes WHERE book_id = ?').bind(params.id).first();
  return Response.json({ liked: !existing, likeCount: Number(count?.count || 0) });
}
