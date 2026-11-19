// GET /api/me — 获取当前登录用户信息（轻量验证端点）
import { checkUser } from './_utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await checkUser(request, env);
  if (!auth.ok) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const user = await env.DB.prepare('SELECT bio, avatar_url, email, email_verified FROM admin_users WHERE id = ?').bind(auth.userId).first();
  return Response.json({
    userId: auth.userId,
    username: auth.username,
    role: auth.role,
    bio: user?.bio || '',
    avatarUrl: user?.avatar_url || ''
    ,email: user?.email || '',
    emailVerified: !!user?.email_verified
  });
}
