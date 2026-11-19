// /api/comments?bookId=N — 书籍评论区
// GET    列出评论（公开）
// POST   发表评论（仅登录用户）
// DELETE 删除自己的评论（管理员可删任意评论）
import { checkUser, checkAdmin, ensureCommentSchema, validateId } from './_utils.js';

const MAX_LEN = 500;
const PAGE_SIZE = 20;

// 评论数据变化频繁，禁止任何层级缓存
const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Pragma': 'no-cache'
};

function jsonError(msg, status = 400) {
  return Response.json({ error: msg }, { status, headers: NO_STORE });
}

function jsonOk(payload, status = 200) {
  return Response.json(payload, { status, headers: NO_STORE });
}

// GET /api/comments?bookId=1&page=1
export async function onRequestGet(context) {
  const { request, env } = context;
  await ensureCommentSchema(env);

  const url = new URL(request.url);
  const bookId = url.searchParams.get('bookId');
  if (!validateId(bookId)) return jsonError('无效的书籍ID', 400);

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const auth = await checkUser(request, env);

  const totalRow = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM book_comments WHERE book_id = ? AND status = 'normal'"
  ).bind(bookId).first().catch(() => ({ c: 0 }));
  const total = Number(totalRow?.c || 0);

  const { results } = await env.DB.prepare(`
    SELECT c.id, c.content, c.created_at, c.parent_id, c.user_id,
           u.username, u.role, u.avatar_url
    FROM book_comments c
    JOIN admin_users u ON c.user_id = u.id
    WHERE c.book_id = ? AND c.status = 'normal'
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT ? OFFSET ?
  `).bind(bookId, PAGE_SIZE, offset).all().catch(() => ({ results: [] }));

  const comments = (results || []).map(r => ({
    id: r.id,
    content: r.content,
    createdAt: r.created_at,
    parentId: r.parent_id,
    userId: r.user_id,
    username: r.username,
    role: r.role,
    avatarUrl: r.avatar_url,
    mine: auth.ok && auth.userId === r.user_id,
    canDelete: auth.ok && (auth.userId === r.user_id || ['super_admin', 'admin'].includes(auth.role))
  }));

  return jsonOk({
    comments,
    total,
    page,
    pageSize: PAGE_SIZE,
    hasMore: offset + comments.length < total,
    loggedIn: !!auth.ok
  });
}

// POST /api/comments — body: { bookId, content, parentId? }
export async function onRequestPost(context) {
  const { request, env } = context;
  await ensureCommentSchema(env);

  const auth = await checkUser(request, env);
  if (!auth.ok) return jsonError('请先登录后再评论', 401);
  if (auth.role === 'reader' && !auth.userId) return jsonError('请先登录后再评论', 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('请求格式错误', 400);
  }

  const bookId = body.bookId;
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const parentId = body.parentId ? Number(body.parentId) : null;

  if (!validateId(String(bookId))) return jsonError('无效的书籍ID', 400);
  if (!content) return jsonError('评论内容不能为空', 400);
  if (content.length > MAX_LEN) return jsonError(`评论不能超过 ${MAX_LEN} 字`, 400);

  // 账号状态
  const status = await env.DB.prepare(
    'SELECT muted_until, banned_at FROM admin_users WHERE id = ?'
  ).bind(auth.userId).first().catch(() => null);
  if (status?.banned_at) return jsonError('账号已被封禁', 403);
  if (status?.muted_until && new Date(status.muted_until) > new Date()) {
    return jsonError('禁言期间不可发表评论', 403);
  }

  // 书籍存在且未下架
  const book = await env.DB.prepare(
    'SELECT id, status FROM books WHERE id = ?'
  ).bind(bookId).first().catch(() => null);
  if (!book || (book.status && book.status !== 'normal')) {
    return jsonError('书籍不存在', 404);
  }

  if (parentId) {
    const parent = await env.DB.prepare(
      'SELECT id FROM book_comments WHERE id = ? AND book_id = ?'
    ).bind(parentId, bookId).first().catch(() => null);
    if (!parent) return jsonError('回复的评论不存在', 404);
  }

  const res = await env.DB.prepare(
    'INSERT INTO book_comments (book_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)'
  ).bind(bookId, auth.userId, parentId, content).run();

  const id = res.meta?.last_row_id;
  const row = await env.DB.prepare(`
    SELECT c.id, c.content, c.created_at, c.parent_id, c.user_id, u.username, u.role, u.avatar_url
    FROM book_comments c JOIN admin_users u ON c.user_id = u.id WHERE c.id = ?
  `).bind(id).first().catch(() => null);

  return jsonOk({
    comment: row ? {
      id: row.id, content: row.content, createdAt: row.created_at,
      parentId: row.parent_id, userId: row.user_id, username: row.username,
      role: row.role, avatarUrl: row.avatar_url, mine: true, canDelete: true
    } : null
  }, { status: 201 });
}

// DELETE /api/comments?id=N
export async function onRequestDelete(context) {
  const { request, env } = context;
  await ensureCommentSchema(env);

  const auth = await checkUser(request, env);
  if (!auth.ok) return jsonError('请先登录', 401);

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!validateId(id)) return jsonError('无效的评论ID', 400);

  const row = await env.DB.prepare(
    'SELECT id, user_id FROM book_comments WHERE id = ?'
  ).bind(id).first().catch(() => null);
  if (!row) return jsonError('评论不存在', 404);

  const isOwner = row.user_id === auth.userId;
  const isAdmin = ['super_admin', 'admin'].includes(auth.role);
  if (!isOwner && !isAdmin) return jsonError('无权删除该评论', 403);

  // 软删除，保留审计记录
  await env.DB.prepare("UPDATE book_comments SET status = 'deleted' WHERE id = ?").bind(id).run();
  return jsonOk({ ok: true });
}
