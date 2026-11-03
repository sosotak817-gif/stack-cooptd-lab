import '../../ui/weekly-rules.js';
import { revision } from '../../server/shared-calculation-version.mjs';

const { weekAt, dayAt, moveLimit } = globalThis.CoopWeekly;

const schema = `
CREATE TABLE IF NOT EXISTS daily_puzzle_scores (
  week INTEGER NOT NULL,
  revision TEXT NOT NULL,
  nickname_key TEXT NOT NULL,
  nickname TEXT NOT NULL,
  score REAL NOT NULL,
  moves INTEGER NOT NULL,
  achieved_at INTEGER NOT NULL,
  PRIMARY KEY (week, revision, nickname_key)
);
CREATE INDEX IF NOT EXISTS daily_puzzle_leaderboard
  ON daily_puzzle_scores (week, revision, score DESC, moves, achieved_at, nickname_key);
`;

export async function onRequest({ request, env }) {
  return handle(request, env.DB);
}

async function handle(request, db, retry = true) {
  const reply = (body, status = 200) => Response.json(body, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
  const now = Date.now();
  const currentWeek = weekAt(now), currentDay = dayAt(now);
  if (!db) return reply({ currentWeek, currentDay, error: '랭킹 DB 연결을 확인해 주세요.' }, 503);
  try {
    if (request.method === 'POST') {
      if (new URL(request.url).origin !== request.headers.get('Origin')) {
        return reply({ error: '사이트에서 직접 등록해 주세요.' }, 403);
      }
      if (Number(request.headers.get('Content-Length')) > 2048) return reply({ error: '요청이 너무 큽니다.' }, 413);
      let body;
      try { body = JSON.parse(await (retry ? request.clone() : request).text()); }
      catch { return reply({ error: '등록 형식을 확인해 주세요.' }, 400); }
      if (body?.day !== currentDay || body?.revision !== revision) {
        return reply({ error: '퍼즐이 갱신됐어요. 새로고침해 주세요.' }, 409);
      }
      const nickname = typeof body.nickname === 'string' ? body.nickname.trim().normalize('NFC') : '';
      const { score, moves } = body;
      if (!nickname || nickname.length > 40 || /[\u0000-\u001f\u007f]/u.test(nickname) ||
          !Number.isFinite(score) || score < -100 || score > 1e9 ||
          !Number.isInteger(moves) || moves < 0 || moves > moveLimit) {
        return reply({ error: '닉네임과 계산 기록을 확인해 주세요.' }, 400);
      }
      const nicknameKey = nickname.toLowerCase().normalize('NFC');
      if (dayAt() !== currentDay) return reply({ error: '새 오늘의 퍼즐을 열어 주세요.' }, 409);
      const saved = await db.prepare(`
        INSERT INTO daily_puzzle_scores (week, revision, nickname_key, nickname, score, moves, achieved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (week, revision, nickname_key) DO UPDATE SET
          nickname = excluded.nickname, score = excluded.score, moves = excluded.moves, achieved_at = excluded.achieved_at
        WHERE excluded.score > score OR (excluded.score = score AND excluded.moves < moves)
      `).bind(currentWeek, revision, nicknameKey, nickname, score, moves, Date.now()).run();
      return reply({ improved: !!saved.meta.changes });
    }
    if (request.method !== 'GET') return reply({ error: '지원하지 않는 요청입니다.' }, 405);
    const query = new URL(request.url).searchParams;
    const week = query.has('week') ? Number(query.get('week')) : currentWeek;
    if (!Number.isInteger(week) || week < 0 || week > currentWeek) return reply({ error: '주차를 확인해 주세요.' }, 400);
    const selectedRevision = week === currentWeek ? revision : (await db.prepare(
      'SELECT revision FROM daily_puzzle_scores WHERE week = ? ORDER BY achieved_at DESC LIMIT 1'
    ).bind(week).first())?.revision;
    const rows = selectedRevision ? (await db.prepare(`
      SELECT nickname, score, moves FROM daily_puzzle_scores WHERE week = ? AND revision = ?
      ORDER BY score DESC, moves ASC, achieved_at ASC, nickname_key ASC LIMIT 50
    `).bind(week, selectedRevision).all()).results : [];
    return reply({ currentWeek, currentDay, week, rows });
  } catch (error) {
    if (retry && /no such table: daily_puzzle_scores/.test(String(error))) {
      try {
        await db.batch(schema.trim().split(';').filter(sql => sql.trim()).map(sql => db.prepare(sql)));
        return handle(request, db, false);
      } catch (setupError) {
        console.error('weekly puzzle schema', setupError);
      }
    }
    console.error('weekly puzzle ranking', error);
    return reply({ currentWeek, currentDay, error: '랭킹을 불러오거나 저장하지 못했어요.' }, 503);
  }
}
