// GET /api/search?q=keyword&book_id=1&page=1&limit=20 — 搜索书籍或章节标题
// 简单内存速率限制（每个isolate实例独立，CF Workers会自动分配）
const searchRateMap = new Map();
const SEARCH_RATE_LIMIT = 30; // 每分钟每IP最多30次搜索
const SEARCH_RATE_WINDOW = 60000; // 1分钟窗口
const RATE_MAP_MAX_SIZE = 1000;

// 分页参数
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_PAGE = 1000;

// 搜索词长度
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 50;

// 只有 normal 状态的书籍对公开搜索可见
const VISIBLE_BOOK_CONDITION = "(b.status IS NULL OR b.status = 'normal')";

function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP')
    || (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim()
    || 'unknown';
}

function isRateLimited(ip, now) {
  const entry = searchRateMap.get(ip);
  if (entry && now - entry.start < SEARCH_RATE_WINDOW) {
    if (entry.count >= SEARCH_RATE_LIMIT) return true;
    entry.count++;
    return false;
  }
  searchRateMap.set(ip, { start: now, count: 1 });
  // 定期清理过期条目（防内存泄漏）
  if (searchRateMap.size > RATE_MAP_MAX_SIZE) {
    for (const [key, value] of searchRateMap) {
      if (now - value.start > SEARCH_RATE_WINDOW) searchRateMap.delete(key);
    }
  }
  return false;
}

// 转义 LIKE 通配符，防止用户输入的 % 和 _ 变成通配符
function escapeLike(text) {
  return text.replace(/[%_\\]/g, '\\$&');
}

function buildPagination(page, limit, total) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, hasMore: page < totalPages };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);

  const q = (url.searchParams.get('q') || '').trim();
  const bookId = url.searchParams.get('book_id');

  const rawPage = parseInt(url.searchParams.get('page'), 10);
  const rawLimit = parseInt(url.searchParams.get('limit'), 10);
  const page = Math.min(MAX_PAGE, Math.max(1, Number.isFinite(rawPage) ? rawPage : DEFAULT_PAGE));
  const limit = Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Number.isFinite(rawLimit) ? rawLimit : DEFAULT_LIMIT));
  const offset = (page - 1) * limit;

  // 参数校验放在限流之前，非法请求不消耗配额
  if (!q || q.length < MIN_QUERY_LENGTH) {
    return Response.json({ error: `搜索词至少 ${MIN_QUERY_LENGTH} 个字符` }, { status: 400 });
  }
  if (q.length > MAX_QUERY_LENGTH) {
    return Response.json({ error: `搜索词不能超过 ${MAX_QUERY_LENGTH} 个字符` }, { status: 400 });
  }
  if (bookId && !/^\d+$/.test(bookId)) {
    return Response.json({ error: '无效的 book_id' }, { status: 400 });
  }

  const now = Date.now();
  if (isRateLimited(getClientIp(request), now)) {
    return Response.json({ error: '搜索过于频繁，请稍后再试' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(SEARCH_RATE_WINDOW / 1000)) }
    });
  }

  const like = `%${escapeLike(q)}%`;

  // 如果指定了 book_id，搜索该书的章节标题
  if (bookId) {
    const book = await env.DB.prepare(
      `SELECT b.id FROM books b WHERE b.id = ? AND ${VISIBLE_BOOK_CONDITION}`
    ).bind(bookId).first();
    if (!book) {
      return Response.json({ error: 'Book not found' }, { status: 404 });
    }

    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM chapters WHERE book_id = ? AND title LIKE ? ESCAPE '\\'`
    ).bind(bookId, like).first();
    const total = countResult?.total || 0;

    const { results } = await env.DB.prepare(
      `SELECT id, title, word_count, sort_order FROM chapters
       WHERE book_id = ? AND title LIKE ? ESCAPE '\\'
       ORDER BY sort_order ASC LIMIT ? OFFSET ?`
    ).bind(bookId, like, limit, offset).all();

    return Response.json({
      chapters: results,
      pagination: buildPagination(page, limit, total)
    });
  }

  // 书籍搜索支持分页，先获取总数
  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM books b
     WHERE ${VISIBLE_BOOK_CONDITION}
       AND (b.title LIKE ? ESCAPE '\\' OR b.author LIKE ? ESCAPE '\\')`
  ).bind(like, like).first();
  const total = countResult?.total || 0;

  // 搜索书籍（书名 + 作者）
  const { results } = await env.DB.prepare(
    `SELECT b.id, b.title, b.author, b.description, b.cover_key, b.created_at, b.updated_at,
      (SELECT COUNT(*) FROM chapters WHERE book_id = b.id) as chapter_count,
      (SELECT COALESCE(SUM(word_count), 0) FROM chapters WHERE book_id = b.id) as total_words
     FROM books b
     WHERE ${VISIBLE_BOOK_CONDITION}
       AND (b.title LIKE ? ESCAPE '\\' OR b.author LIKE ? ESCAPE '\\')
     ORDER BY b.updated_at DESC LIMIT ? OFFSET ?`
  ).bind(like, like, limit, offset).all();

  return Response.json({
    books: results,
    pagination: buildPagination(page, limit, total)
  });
}
