import {requireAccountSession} from '../../../server/accounts.mjs';
import {achievementNoticeSchema} from '../../../server/account-schema.mjs';
import {syncAchievements} from '../../../server/achievements.mjs';

const initialized = new WeakMap();
function ensureNotices(db) {
 if (!initialized.has(db)) {
  const setup = db.batch(achievementNoticeSchema.map(sql=>db.prepare(sql)));
  initialized.set(db,setup);
  setup.catch(()=>initialized.delete(db));
 }
 return initialized.get(db);
}

export async function onRequest({request,env}) {
 const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='POST')return reply({error:'지원하지 않는 요청입니다.'},405);
 try {
  const user=await requireAccountSession(request,env,true);
  if(request.headers.get('X-Account-Id')!==user.id)return reply({error:'로그인 계정이 변경되었습니다.'},409);
  const db=env.DB;
  await ensureNotices(db);
  await syncAchievements(db,user.id);
  const [notices,claimed]=await db.batch([
   db.prepare(`SELECT a.code,a.title FROM lab_achievement_notices n JOIN lab_achievements a ON a.code=n.code
    JOIN lab_user_achievements u ON u.user_id=n.user_id AND u.code=n.code
    WHERE n.user_id=? ORDER BY u.earned_at,a.code`).bind(user.id),
   db.prepare('DELETE FROM lab_achievement_notices WHERE user_id=? RETURNING code').bind(user.id)
  ]);
  const codes=new Set(claimed.results.map(row=>row.code));
  return reply({badges:notices.results.filter(badge=>codes.has(badge.code))});
 } catch(error) {
  return reply({error:error.status?error.message:'업적 알림을 불러오지 못했습니다.'},error.status||503);
 }
}
