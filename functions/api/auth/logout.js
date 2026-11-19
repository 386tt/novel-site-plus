// POST /api/auth/logout — 登出
import { checkUser, clearAuthCookie } from '../_utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = await checkUser(request, env);
  if (auth.ok) await env.DB.prepare('DELETE FROM admin_sessions WHERE user_id = ?').bind(auth.userId).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Set-Cookie': clearAuthCookie()
    }
  });
}
