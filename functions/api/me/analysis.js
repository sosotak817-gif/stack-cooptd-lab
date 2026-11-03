import { readBoardBody, requireAccountSession } from '../../../server/accounts.mjs';

export async function onRequest({ request, env }) {
  const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  const write = request.method === 'POST';
  if (!write && request.method !== 'GET') return reply({ error: '지원하지 않는 요청입니다.' }, 405);
  try {
    const user = await requireAccountSession(request, env, write);
    if (request.headers.get('X-Account-Id') !== user.id) return reply({ error: '로그인 계정이 변경되었습니다.' }, 409);
    const db = env.DB;
    if (!write) {
      const { results } = await db.prepare(`SELECT id, tool, title, summary, created_at AS createdAt
        FROM lab_analysis_records WHERE user_id=? ORDER BY created_at DESC,id LIMIT 30`).bind(user.id).all();
      return reply({ records: results });
    }
    const input = await readBoardBody(request);
    const title = typeof input?.title === 'string' ? input.title.trim() : '';
    const summary = typeof input?.summary === 'string' ? input.summary.trim() : '';
    if (!title || title.length > 120 || !summary || summary.length > 2000 ||
        typeof input?.tool !== 'string' || !/^[a-z-]{1,24}$/.test(input.tool)) {
      return reply({ error: '분석 제목과 결과 요약을 확인해 주세요.' }, 400);
    }
    const row = await db.prepare(`INSERT INTO lab_analysis_records(id,user_id,tool,title,summary,created_at)
      SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM lab_analysis_records WHERE user_id=?) < 30
      RETURNING id`).bind(crypto.randomUUID(),user.id,input.tool,title,summary,Date.now(),user.id).first();
    if (!row) return reply({ error: '분석 기록은 계정당 최대 30개까지 보관할 수 있습니다.' }, 409);
    return reply({ id: row.id }, 201);
  } catch (error) {
    return reply({ error: error.status ? error.message : '분석 기록 연결을 확인해 주세요.' }, error.status || 503);
  }
}
