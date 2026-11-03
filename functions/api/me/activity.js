import { requireAccountSession } from '../../../server/accounts.mjs';

export async function onRequest({ request, env }) {
  const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'GET') return reply({ error: '지원하지 않는 요청입니다.' }, 405);
  try {
    const user = await requireAccountSession(request, env);
    if (request.headers.get('X-Account-Id') !== user.id) return reply({ error: '로그인 계정이 변경되었습니다.' }, 409);
    const db = env.DB;
    const [puzzles, guides, totals] = await db.batch([
      db.prepare(`SELECT week, score, moves, achieved_at AS achievedAt, json_extract(replay, '$.day') AS day
        FROM daily_puzzle_account_scores WHERE user_id=? ORDER BY achieved_at DESC, week DESC, revision DESC LIMIT 20`).bind(user.id),
      db.prepare(`SELECT id, title, updated_at AS updatedAt FROM deck_guides
        WHERE owner=? ORDER BY updated_at DESC, id LIMIT 20`).bind('account:' + user.id),
      db.prepare(`SELECT
        (SELECT COUNT(*) FROM lab_decks WHERE user_id=?) AS savedDecks,
        (SELECT COUNT(*) FROM daily_puzzle_account_scores WHERE user_id=?) AS puzzleRecords,
        (SELECT COUNT(*) FROM deck_guides WHERE owner=?) AS publishedGuides`).bind(user.id, user.id, 'account:' + user.id)
    ]);
    return reply({ puzzles: puzzles.results, guides: guides.results, stats: totals.results[0] });
  } catch (error) {
    return reply({ error: error.status ? error.message : '활동 기록을 불러오지 못했습니다.' }, error.status || 503);
  }
}
