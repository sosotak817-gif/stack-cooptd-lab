import {requireAccountSession} from '../../../server/accounts.mjs';

const discoveries = new Map([
 ['archive',['hidden-archive','기록의 틈새']],
 ['roadmap',['hidden-roadmap','연구의 첫걸음']],
 ['puzzle',['hidden-puzzle-spark','퍼즐 속 불씨']]
]);

export async function onRequest({request,env}) {
 const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='POST')return reply({error:'지원하지 않는 요청입니다.'},405);
 try{
  const user=await requireAccountSession(request,env,true);
  if(request.headers.get('X-Account-Id')!==user.id)return reply({error:'로그인 계정이 변경되었습니다.'},409);
  const key=new URL(request.url).searchParams.get('spot') ?? 'archive';
  const discovery=discoveries.get(key);
  if(!discovery)return reply({error:'발견할 수 없는 표식입니다.'},404);
  const [code,title]=discovery;
  const db=env.DB;
  const [,award]=await db.batch([
   db.prepare("INSERT OR IGNORE INTO lab_achievements(code,title) VALUES (?,?)").bind(code,title),
   db.prepare("INSERT OR IGNORE INTO lab_user_achievements(user_id,code,earned_at) VALUES (?,?,?)").bind(user.id,code,Date.now())
  ]);
  return reply({earned:!!award.meta.changes,...(key==='archive'?{}:{title})});
 }catch(error){
  return reply({error:error.status?error.message:'발견 기록을 저장하지 못했습니다.'},error.status||503);
 }
}
