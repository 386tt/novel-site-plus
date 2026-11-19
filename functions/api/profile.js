import { checkUser, ensureSchema } from './_utils.js';

const MAX_AVATAR_BYTES = 1024 * 1024;
const MAX_BACKGROUND_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function isValidImage(type, bytes) {
  return (type === 'image/png' && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    || (type === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8)
    || (type === 'image/gif' && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46)
    || (type === 'image/webp' && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50);
}

function profileFields() {
  return `u.id, u.username, u.role, u.bio, u.avatar_url, u.profile_bg_url,
    (SELECT COUNT(*) FROM book_likes bl WHERE bl.user_id = u.id) AS favorite_count`;
}

async function getFavoriteBooks(env, userId, viewerId) {
  const likedExpr = viewerId ? 'EXISTS (SELECT 1 FROM book_likes mine WHERE mine.book_id = b.id AND mine.user_id = ?) AS liked' : '0 AS liked';
  const binds = viewerId ? [viewerId, userId] : [userId];
  const { results } = await env.DB.prepare(`
    SELECT b.id, b.title, b.author, b.cover_key,
      (SELECT COUNT(*) FROM book_likes bl WHERE bl.book_id = b.id) AS like_count,
      ${likedExpr}
    FROM books b JOIN book_likes own ON own.book_id = b.id AND own.user_id = ?
    WHERE b.status IS NULL OR b.status = 'normal'
    ORDER BY own.created_at DESC
    LIMIT 12
  `).bind(...binds).all();
  return results || [];
}

export async function onRequestGet(context) {
  const { request, env } = context;
  await ensureSchema(env);
  const url = new URL(request.url);
  const requestedId = url.searchParams.get('userId');
  if (requestedId) {
    if (!/^\d{1,18}$/.test(requestedId)) return Response.json({ error: '用户ID无效' }, { status: 400 });
    const user = await env.DB.prepare(
      `SELECT ${profileFields()} FROM admin_users u WHERE u.id = ? AND u.role = 'reader'`
    ).bind(requestedId).first();
    if (!user) return Response.json({ error: '用户不存在' }, { status: 404 });
    const favorites = await getFavoriteBooks(env, requestedId, null);
    return Response.json({ user, favorites }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const auth = await checkUser(request, env);
  if (!auth.ok) return Response.json({ error: '请先登录' }, { status: 401 });
  const user = await env.DB.prepare(
    `SELECT ${profileFields()} FROM admin_users u WHERE u.id = ?`
  ).bind(auth.userId).first();
  if (!user) return Response.json({ error: '用户不存在' }, { status: 404 });
  const favorites = await getFavoriteBooks(env, auth.userId, auth.userId);
  return Response.json({ user, favorites }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const auth = await checkUser(request, env);
  if (!auth.ok) return Response.json({ error: '请先登录' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const bio = String(body?.bio || '').trim();
  if (bio.length > 200) return Response.json({ error: '简介不能超过200字' }, { status: 400 });
  await ensureSchema(env);
  await env.DB.prepare("UPDATE admin_users SET bio = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(bio || null, auth.userId).run();
  return Response.json({ success: true, bio });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await checkUser(request, env);
  if (!auth.ok) return Response.json({ error: '请先登录' }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const type = form?.get('type') === 'background' ? 'background' : 'avatar';
  const field = type === 'background' ? 'background' : 'avatar';
  const file = form?.get(field);
  if (!(file instanceof File)) return Response.json({ error: `请选择${type === 'background' ? '背景图' : '头像'}文件` }, { status: 400 });
  const maxBytes = type === 'background' ? MAX_BACKGROUND_BYTES : MAX_AVATAR_BYTES;
  if (file.size <= 0 || file.size > maxBytes) {
    return Response.json({ error: `${type === 'background' ? '背景图' : '头像'}文件不能超过${type === 'background' ? '5MB' : '1MB'}` }, { status: 400 });
  }
  if (!IMAGE_TYPES.has(file.type)) return Response.json({ error: '仅支持 JPG、PNG、WebP 或 GIF' }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isValidImage(file.type, bytes)) return Response.json({ error: '图片文件内容无效' }, { status: 400 });
  await ensureSchema(env);
  const folder = type === 'background' ? 'profile-backgrounds' : 'avatars';
  const key = `${folder}/${auth.userId}-${crypto.randomUUID()}`;
  await env.R2.put(key, bytes, { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=86400' } });
  const url = `/api/profile/avatar?key=${encodeURIComponent(key)}`;
  const column = type === 'background' ? 'profile_bg_url' : 'avatar_url';
  await env.DB.prepare(`UPDATE admin_users SET ${column} = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(url, auth.userId).run();
  return Response.json({ success: true, [type === 'background' ? 'backgroundUrl' : 'avatarUrl']: url });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const auth = await checkUser(request, env);
  if (!auth.ok) return Response.json({ error: '请先登录' }, { status: 401 });
  await ensureSchema(env);
  const user = await env.DB.prepare('SELECT avatar_url FROM admin_users WHERE id = ?').bind(auth.userId).first();
  const key = user?.avatar_url?.match(/[?&]key=([^&]+)/)?.[1];
  if (key) await env.R2.delete(decodeURIComponent(key));
  await env.DB.prepare("UPDATE admin_users SET avatar_url = NULL, updated_at = datetime('now') WHERE id = ?").bind(auth.userId).run();
  return Response.json({ success: true });
}
