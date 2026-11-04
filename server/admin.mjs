import {requireAccountSession,readBoardBody} from './accounts.mjs';
import {isAdmin} from './admin-role.mjs';

export async function requireAdmin(request,env,write=false) {
 const user=await requireAccountSession(request,env,write);
 if(!await isAdmin(env.DB,user))throw Object.assign(Error('관리자만 접근할 수 있습니다.'),{status:403});
 return user;
}

export async function handleAdmin({request,env}) {
 const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 try {
  if(!['GET','POST'].includes(request.method))return reply({error:'지원하지 않는 요청입니다.'},405);
  const user=await requireAdmin(request,env,request.method==='POST');
  if(request.headers.get('X-Account-Id')!==user.id)return reply({error:'로그인 계정이 변경되었습니다.'},409);
  if(request.method==='GET'){
   const tables=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
   return reply({user:{id:user.id,nickname:user.nickname},tables:tables.results.map(row=>row.name)});
  }
  const input=await readBoardBody(request);
  if(input.action==='reset-votes'){
   const table={gems:'gem_tier_votes',demons:'tier_votes'}[input.kind];
   if(!table)return reply({error:'투표 종류를 확인하세요.'},400);
   await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS '+table+' (voter TEXT PRIMARY KEY, ballot TEXT NOT NULL, updated_at INTEGER NOT NULL)'),
    env.DB.prepare('DELETE FROM '+table)
   ]);
   return reply({message:'투표를 초기화했습니다.'});
  }
  if(input.action!=='sql'||typeof input.sql!=='string'||!input.sql.trim()||input.sql.length>20000)
   return reply({error:'실행할 SQL을 확인하세요.'},400);
  const result=await env.DB.prepare(input.sql.trim()).all();
  return reply({results:result.results,changes:result.meta?.changes||0});
 }catch(error){
  return reply({error:error.status?error.message:'관리자 작업 실패 · '+error.message},error.status||400);
 }
}
