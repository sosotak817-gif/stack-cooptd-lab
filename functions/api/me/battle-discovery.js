import {requireAccountSession} from '../../../server/accounts.mjs';

const milestones = new Map([
 ['finish', { code: 'hidden-battle-watch', title: '전투 관전', duration: 60000 }],
 ['finish-long', { code: 'hidden-battle-witness', title: '전장의 증인', duration: 600000 }]
]);

export async function onRequest({request,env}) {
 const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='POST')return reply({error:'지원하지 않는 요청입니다.'},405);
 try {
  const user=await requireAccountSession(request,env,true);
  if(request.headers.get('X-Account-Id')!==user.id)return reply({error:'로그인 계정이 변경되었습니다.'},409);
  const action=new URL(request.url).searchParams.get('action');
  const db=env.DB, now=Date.now();
  if(action==='start'){
   await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS lab_battle_watch (user_id TEXT PRIMARY KEY REFERENCES lab_users(id) ON DELETE CASCADE, started_at INTEGER NOT NULL)'),
    db.prepare('INSERT INTO lab_battle_watch VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET started_at=excluded.started_at').bind(user.id,now)
   ]);
   return reply({started:true});
  }
  const milestone=milestones.get(action);
  if(!milestone)return reply({error:'지원하지 않는 요청입니다.'},400);
  const {code,title,duration}=milestone, cutoff=now-duration;
  const [watch,,award]=await db.batch([
   db.prepare('SELECT 1 FROM lab_battle_watch WHERE user_id=? AND started_at<=?').bind(user.id,cutoff),
   db.prepare('INSERT OR IGNORE INTO lab_achievements VALUES (?,?)').bind(code,title),
   db.prepare(`INSERT OR IGNORE INTO lab_user_achievements
    SELECT user_id,?,? FROM lab_battle_watch WHERE user_id=? AND started_at<=?`).bind(code,now,user.id,cutoff)
  ]);
  if(!watch.results.length)return reply({error:'관전 시간이 부족합니다.'},409);
  return reply({earned:!!award.meta.changes,title});
 }catch(error){
  return reply({error:error.status?error.message:'관전 기록을 저장하지 못했습니다.'},error.status||503);
 }
}
