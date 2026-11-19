export async function onRequestGet(context) {
  const { request, env } = context;
  const key = new URL(request.url).searchParams.get('key');
  if (!key || !/^(?:avatars|profile-backgrounds)\/\d+-[0-9a-f-]+$/.test(key)) return new Response('Not found', { status: 404 });
  const object = await env.R2.get(key);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=86400');
  return new Response(object.body, { headers });
}
