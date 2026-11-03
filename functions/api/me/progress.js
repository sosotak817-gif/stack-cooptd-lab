import { readBoardBody, requireAccountSession } from '../../../server/accounts.mjs';

const steps = new Set(['owned','conditions','save','diagnosis','cause','next','timing','partner','publish']);

export async function onRequest({request,env}) {
  const reply = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
  const write = request.method === 'PUT';
  if (!write && request.method !== 'GET') return reply({error:'지원하지 않는 요청입니다.'},405);
  try {
    const user = await requireAccountSession(request,env,write);
    if (request.headers.get('X-Account-Id') !== user.id) return reply({error:'로그인 계정이 변경되었습니다.'},409);
    const db = env.DB;
    if (!write) {
      const row = await db.prepare('SELECT data,revision FROM lab_progress WHERE user_id=?').bind(user.id).first();
      return reply({checks:row ? JSON.parse(row.data) : {},revision:row?.revision ?? 0});
    }
    const input = await readBoardBody(request);
    const checks = input?.checks;
    if (!Number.isSafeInteger(input?.revision) || input.revision < 0 || !checks ||
        typeof checks !== 'object' || Array.isArray(checks) ||
        Object.entries(checks).some(([key,value]) => !steps.has(key) || typeof value !== 'boolean')) {
      return reply({error:'로드맵 진행 기록을 확인해 주세요.'},400);
    }
    const row = await db.prepare(`INSERT INTO lab_progress(user_id,data,revision)
      SELECT ?,?,1 WHERE ?=0 OR EXISTS(SELECT 1 FROM lab_progress WHERE user_id=?)
      ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,revision=lab_progress.revision+1
      WHERE lab_progress.revision=? RETURNING revision`)
      .bind(user.id,JSON.stringify(checks),input.revision,user.id,input.revision).first();
    return row ? reply(row) : reply({error:'다른 브라우저에서 진행 기록이 변경되었습니다. 다시 확인해 주세요.'},409);
  } catch (error) {
    return reply({error:error.status?error.message:'로드맵 연결을 확인해 주세요.'},error.status||503);
  }
}
