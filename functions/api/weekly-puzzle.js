import '../../ui/weekly-rules.js';
import '../../ui/board-presets.js';
import { catalog } from '../../server/guide-catalog.mjs';
import { requireAccountSession } from '../../server/accounts.mjs';
import { revision } from '../../server/shared-calculation-version.mjs';
import { verifiedPuzzleScore } from '../../server/puzzle-score.mjs';

const rankingRevision = revision + ':server-score-v1';

const { weekAt, dayAt, puzzle, move, moveLimit } = globalThis.CoopWeekly;

const validTiles = new Set(catalog.tiles.filter(tile => Number(tile.split(':')[0]) > 5)
  .map(tile => { const [row, col] = tile.split(':').map(Number); return row * 7 + col; }));

const schema = `
CREATE TABLE IF NOT EXISTS daily_puzzle_scores (
  week INTEGER NOT NULL,
  revision TEXT NOT NULL,
  nickname_key TEXT NOT NULL,
  nickname TEXT NOT NULL,
  score REAL NOT NULL,
  moves INTEGER NOT NULL,
  achieved_at INTEGER NOT NULL,
  replay TEXT,
  PRIMARY KEY (week, revision, nickname_key)
);
CREATE INDEX IF NOT EXISTS daily_puzzle_leaderboard
  ON daily_puzzle_scores (week, revision, score DESC, moves, achieved_at, nickname_key);
`;

export async function onRequest({ request, env }) {
  return handle(request, env);
}

async function handle(request, env, retry = true) {
  const db = env.DB;
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
      let account = null;
      if (request.headers.has('X-CSRF-Token')) {
        try { account = await requireAccountSession(request, env, true); }
        catch (error) {
          if (!error.status) throw error;
          return reply({ error: error.message }, error.status);
        }
      }
      const nickname = account ? account.nickname : typeof body.nickname === 'string' ? body.nickname.trim().normalize('NFC') : '';
      const { moves } = body;
      if (!nickname || nickname.length > 40 || /[\u0000-\u001f\u007f]/u.test(nickname) ||
          !Number.isInteger(moves) || moves < 0 || moves > moveLimit) {
        return reply({ error: '닉네임과 계산 기록을 확인해 주세요.' }, 400);
      }
      const steps = body.steps;
      if (!Array.isArray(steps) || steps.length !== moves) return reply({ error: '배치 기록을 확인해 주세요.' }, 400);
      const challenge = puzzle(currentDay, globalThis.CoopPresets.presets);
      let cells = challenge.cells;
      for (const step of steps) {
        if (!Array.isArray(step) || step.length !== 2) return reply({ error: '배치 기록을 확인해 주세요.' }, 400);
        const [from, to] = step;
        if (!validTiles.has(from) || !validTiles.has(to) || from === to ||
            !cells.some(cell => cell.row * 7 + cell.col === from)) {
          return reply({ error: '이동할 수 없는 칸이 포함되어 있어요.' }, 400);
        }
        cells = move(cells, from, to);
      }
      const score = verifiedPuzzleScore(challenge, cells, moves);
      const replay = JSON.stringify({ day: currentDay, ...challenge, steps });
      const nicknameKey = nickname.toLowerCase().normalize('NFC');
      if (dayAt() !== currentDay) return reply({ error: '새 오늘의 퍼즐을 열어 주세요.' }, 409);
      if (account) {
        const saved = await db.prepare(`
          INSERT INTO daily_puzzle_account_scores (week, revision, user_id, score, moves, achieved_at, replay)
          SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (
            SELECT 1 FROM lab_sessions WHERE token_hash = ? AND user_id = ? AND expires_at > ?
          )
          ON CONFLICT (week, revision, user_id) DO UPDATE SET
            score = excluded.score, moves = excluded.moves, achieved_at = excluded.achieved_at, replay = excluded.replay
          WHERE excluded.score > score OR (excluded.score = score AND excluded.moves < moves)
        `).bind(currentWeek, rankingRevision, account.id, score, moves, Date.now(), replay,
          account.token_hash, account.id, Date.now()).run();
        return reply({ improved: !!saved.meta.changes, account: true });
      }
      const saved = await db.prepare(`
        INSERT INTO daily_puzzle_scores (week, revision, nickname_key, nickname, score, moves, achieved_at, replay)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (week, revision, nickname_key) DO UPDATE SET
          nickname = excluded.nickname, score = excluded.score, moves = excluded.moves,
          achieved_at = CASE WHEN excluded.score = score AND excluded.moves = moves THEN achieved_at ELSE excluded.achieved_at END,
          replay = excluded.replay
        WHERE excluded.score > score OR (excluded.score = score AND
          (excluded.moves < moves OR (excluded.moves = moves AND daily_puzzle_scores.replay IS NULL)))
      `).bind(currentWeek, rankingRevision, nicknameKey, nickname, score, moves, Date.now(), replay).run();
      return reply({ improved: !!saved.meta.changes });
    }
    if (request.method !== 'GET') return reply({ error: '지원하지 않는 요청입니다.' }, 405);
    const query = new URL(request.url).searchParams;
    const week = query.has('week') ? Number(query.get('week')) : currentWeek;
    if (!Number.isInteger(week) || week < 0 || week > currentWeek) return reply({ error: '주차를 확인해 주세요.' }, 400);
    let rows;
    try {
      const selectedRevision = week === currentWeek ? rankingRevision : (await db.prepare(`
        SELECT revision FROM (
          SELECT revision, achieved_at FROM daily_puzzle_scores WHERE week = ?
          UNION ALL SELECT revision, achieved_at FROM daily_puzzle_account_scores WHERE week = ?
        ) ORDER BY achieved_at DESC LIMIT 1
      `).bind(week, week).first())?.revision;
      rows = selectedRevision ? (await db.prepare(`
        SELECT nickname, score, moves, replay, account FROM (
          SELECT nickname, score, moves, replay, achieved_at, nickname_key AS sort_key, 0 AS account
          FROM daily_puzzle_scores WHERE week = ? AND revision = ?
          UNION ALL
          SELECT u.nickname, a.score, a.moves, a.replay, a.achieved_at, a.user_id, 1
          FROM daily_puzzle_account_scores a JOIN lab_users u ON u.id = a.user_id
          WHERE a.week = ? AND a.revision = ?
        ) ORDER BY score DESC, moves ASC, achieved_at ASC, account DESC, sort_key ASC LIMIT 50
      `).bind(week, selectedRevision, week, selectedRevision).all()).results : [];
    } catch (error) {
      if (!/no such table: daily_puzzle_account_scores/.test(String(error))) throw error;
      const selectedRevision = week === currentWeek ? rankingRevision : (await db.prepare(
        'SELECT revision FROM daily_puzzle_scores WHERE week = ? ORDER BY achieved_at DESC LIMIT 1'
      ).bind(week).first())?.revision;
      rows = selectedRevision ? (await db.prepare(`
        SELECT nickname, score, moves, replay, 0 AS account FROM daily_puzzle_scores WHERE week = ? AND revision = ?
        ORDER BY score DESC, moves ASC, achieved_at ASC, nickname_key ASC LIMIT 50
      `).bind(week, selectedRevision).all()).results : [];
    }
    return reply({ currentWeek, currentDay, week, rows: rows.map(row => ({ ...row, replay: row.replay ? JSON.parse(row.replay) : null })) });
  } catch (error) {
    if (retry && /no such table: daily_puzzle_scores|no such column: replay|has no column named replay/.test(String(error))) {
      try {
        await db.batch(schema.trim().split(';').filter(sql => sql.trim()).map(sql => db.prepare(sql)));
        const { results } = await db.prepare('PRAGMA table_info(daily_puzzle_scores)').all();
        if (!results.some(column => column.name === 'replay')) {
          try { await db.prepare('ALTER TABLE daily_puzzle_scores ADD COLUMN replay TEXT').run(); }
          catch (error) { if (!/duplicate column name: replay/.test(String(error))) throw error; }
        }
        return handle(request, env, false);
      } catch (setupError) {
        console.error('weekly puzzle schema', setupError);
      }
    }
    console.error('weekly puzzle ranking', error);
    return reply({ currentWeek, currentDay, error: '랭킹을 불러오거나 저장하지 못했어요.' }, 503);
  }
}
