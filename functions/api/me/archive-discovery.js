import {requireAccountSession} from '../../../server/accounts.mjs';

export async function onRequest({request,env}) {
 const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='POST')return reply({error:'지원하지 않는 요청입니다.'},405);
 try{
  const user=await requireAccountSession(request,env,true);
  if(request.headers.get('X-Account-Id')!==user.id)return reply({error:'로그인 계정이 변경되었습니다.'},409);
  const db=env.DB;
  const [,award]=await db.batch([
   db.prepare("INSERT OR IGNORE INTO lab_achievements(code,title) VALUES ('hidden-archive','기록의 틈새')"),
   db.prepare("INSERT OR IGNORE INTO lab_user_achievements(user_id,code,earned_at) VALUES (?,'hidden-archive',?)").bind(user.id,Date.now())
  ]);
  return reply({earned:!!award.meta.changes});
 }catch(error){
  return reply({error:error.status?error.message:'발견 기록을 저장하지 못했습니다.'},error.status||503);
 }
}
