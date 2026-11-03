import {readBoardBody,requireAccountSession} from '../../../server/accounts.mjs';

export async function onRequest({request,env}) {
 const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='PUT')return reply({error:'지원하지 않는 요청입니다.'},405);
 try {
  const user=await requireAccountSession(request,env,true);
  if(request.headers.get('X-Account-Id')!==user.id)return reply({error:'로그인 계정이 변경되었습니다.'},409);
  const {code}=await readBoardBody(request)??{};
  if(code===null){
   await env.DB.prepare('DELETE FROM lab_featured_badges WHERE user_id=?').bind(user.id).run();
   return reply({code:null});
  }
  if(typeof code!=='string'||code.length>80)return reply({error:'배지를 확인해 주세요.'},400);
  const row=await env.DB.prepare(`INSERT INTO lab_featured_badges(user_id,code)
   SELECT user_id,code FROM lab_user_achievements WHERE user_id=? AND code=?
   ON CONFLICT(user_id) DO UPDATE SET code=excluded.code RETURNING code`).bind(user.id,code).first();
  return row?reply(row):reply({error:'획득한 배지만 선택할 수 있습니다.'},400);
 }catch(error){
  return reply({error:error.status?error.message:'대표 배지를 저장하지 못했습니다.'},error.status||503);
 }
}
