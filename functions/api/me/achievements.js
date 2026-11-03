import {requireAccountSession} from '../../../server/accounts.mjs';
import {publicAchievements,syncAchievements} from '../../../server/achievements.mjs';

export async function onRequest({request,env}){
 const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method==='GET')return reply({badges:publicAchievements()});
 if(request.method!=='POST')return reply({error:'지원하지 않는 요청입니다.'},405);
 try{
  const user=await requireAccountSession(request,env,true);
  if(request.headers.get('X-Account-Id')!==user.id)return reply({error:'로그인 계정이 변경되었습니다.'},409);
  return reply({badges:await syncAchievements(env.DB,user.id)});
 }catch(error){
  return reply({error:error.status?error.message:'업적 진행 상황을 불러오지 못했습니다.'},error.status||503);
 }
}
