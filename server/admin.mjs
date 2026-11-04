import {requireAccountSession,readBoardBody} from './accounts.mjs';
import {isAdmin} from './admin-role.mjs';
const voteTables={gems:'gem_tier_votes',demons:'tier_votes'};

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
   const url=new URL(request.url);
   if(url.searchParams.get('view')==='votes'){
    const table=voteTables[url.searchParams.get('kind')];
    const offset=Number(url.searchParams.get('offset')||0);
    if(!table||!Number.isSafeInteger(offset)||offset<0)return reply({error:'투표 조회 조건을 확인하세요.'},400);
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS '+table+' (voter TEXT PRIMARY KEY, ballot TEXT NOT NULL, updated_at INTEGER NOT NULL)').run();
    const [count,rows]=await env.DB.batch([
     env.DB.prepare('SELECT count(*) AS total FROM '+table),
     env.DB.prepare(`SELECT v.voter,v.ballot,v.updated_at AS updatedAt,u.nickname
      FROM ${table} v LEFT JOIN lab_users u ON v.voter='account:'||u.id
      ORDER BY v.updated_at DESC,v.voter LIMIT 50 OFFSET ?`).bind(offset)
    ]);
    return reply({total:count.results[0].total,offset,votes:rows.results.map(row=>{
     let ranking;
     try{ranking=JSON.parse(row.ballot);}catch{}
     return {voter:row.voter,nickname:row.nickname||(row.voter.startsWith('account:')?'삭제된 계정':'비회원 (기존 투표)'),updatedAt:row.updatedAt,
      ranking:Array.isArray(ranking)?ranking.filter(value=>typeof value==='string'):[]};
    })});
   }
   const tables=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
   return reply({user:{id:user.id,nickname:user.nickname},tables:tables.results.map(row=>row.name)});
  }
  const input=await readBoardBody(request);
  if(input.action==='delete-vote'){
   const table=voteTables[input.kind];
   if(!table||typeof input.voter!=='string'||!input.voter||!Number.isSafeInteger(input.updatedAt))
    return reply({error:'삭제할 투표를 확인하세요.'},400);
   const removed=await env.DB.prepare('DELETE FROM '+table+' WHERE voter=? AND updated_at=?').bind(input.voter,input.updatedAt).run();
   if(!removed.meta.changes)return reply({error:'투표가 변경되었거나 이미 삭제되었습니다. 목록을 새로고침하세요.'},409);
   return reply({message:'투표 1건을 삭제했습니다.'});
  }
  if(input.action==='reset-votes'){
   const table=voteTables[input.kind];
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
