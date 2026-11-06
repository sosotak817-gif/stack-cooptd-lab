import { requireAccountSession } from './accounts.mjs';
import {roster} from './tier-roster.mjs';
import {roster as gemRoster} from './gem-tier-roster.mjs';
import Worldcup from '../ui/worldcup-core.js';
import {accessDecision,requireFeatureAccess} from './feature-access.mjs';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
function awards(value,items,requireCurrent=false){
 if(Array.isArray(value)){
  if(value.length!==7||new Set(value).size!==7||value.some(slug=>!items.includes(slug)))return null;
  return value.map((slug,index)=>({slug,points:7-index,rank:index}));
 }
 try{
  const entrants=requireCurrent?items:value.seed?.filter(slug=>slug!==null);
  if(!Array.isArray(entrants)||entrants.some(slug=>!items.includes(slug)))return null;
  const result=Worldcup.replay(value,entrants);
  return result.complete?result.placements.filter(row=>row.points>0):null;
 }catch{return null;}
}
export function validateBallot(value,items=roster){return awards(value,items)!==null;}
export function tally(ballots,items=roster){
 const rows=items.map(slug=>({slug,score:0,votes:0,ranks:Array(7).fill(0)})),map=new Map(rows.map(row=>[row.slug,row]));
 for(const ballot of ballots){
  const results=awards(ballot,items);
  if(!results)continue;
  for(const result of results){
   const row=map.get(result.slug);
   row.score+=result.points;row.votes++;
   if(result.rank!==undefined)row.ranks[result.rank]++;
  }
 }
 return assignVoteTiers(rows);
}
export function assignVoteTiers(rows){
 rows.sort((a,b)=>b.score-a.score||a.slug.localeCompare(b.slug));
 const scored=rows.filter(r=>r.score>0),limit=Math.floor(scored.length/5);
 let zeroCount=0,gapNumerator=0,gapDenominator=1;
 for(let count=1;count<=limit;count++){
  const upper=scored[count-1],lower=scored[count];
  if(!lower)continue;
  const gap=upper.score-lower.score;
  if(upper.score*100>=lower.score*120&&gap*gapDenominator>gapNumerator*lower.score){
   zeroCount=count;gapNumerator=gap;gapDenominator=lower.score;
  }
 }
 const best=scored[zeroCount]?.score||0;
 for(const [i,r]of rows.entries())r.tier=i<zeroCount?'0':!r.score?'미득표':r.score*100>=best*80?'S':r.score*100>=best*60?'A':r.score*100>=best*40?'B':r.score*100>=best*20?'C':'D';
 return rows;
}
const schemas=new WeakMap();
export async function handleTierVotes({request,env}){try{
 if(!['GET','PUT'].includes(request.method))return reply({error:'지원하지 않는 요청입니다.'},405);
 if(!env.DB)return reply({error:'투표 서버 연결을 확인해 주세요.'},503);
 const kind=new URL(request.url).searchParams.get('kind')||'demons';
 if(!['demons','gems'].includes(kind))return reply({error:'티어리스트 종류를 확인해 주세요.'},400);
 const items=kind==='gems'?gemRoster:roster,table=kind==='gems'?'gem_tier_votes':'tier_votes';
 const db=env.DB;
 if(!schemas.has(db))schemas.set(db,new Map());
 const ready=schemas.get(db);
 if(!ready.has(kind))ready.set(kind,db.batch([
  db.prepare('CREATE TABLE IF NOT EXISTS '+table+' (voter TEXT PRIMARY KEY, ballot TEXT NOT NULL, updated_at INTEGER NOT NULL)'),
  ...(kind==='gems'?[
   db.prepare('CREATE TABLE IF NOT EXISTS lab_vote_migrations (id TEXT PRIMARY KEY)'),
   db.prepare("DELETE FROM gem_tier_votes WHERE NOT EXISTS (SELECT 1 FROM lab_vote_migrations WHERE id='2026-11-04-gem-login-reset')"),
   db.prepare("INSERT OR IGNORE INTO lab_vote_migrations VALUES ('2026-11-04-gem-login-reset')")
  ]:[])
 ]).catch(e=>{ready.delete(kind);throw e;}));
 await ready.get(kind);
 let account=null;
 const accountHeaders=request.headers.has('X-Account-Id')||request.headers.has('X-CSRF-Token');
 try{account=await requireAccountSession(request,env,request.method==='PUT');}
 catch(error){if(error.status!==401||accountHeaders)throw error;}
 if(account&&(request.method==='PUT'||accountHeaders)&&request.headers.get('X-Account-Id')!==account.id){
  return reply({error:'로그인 계정이 변경되었습니다.'},409);
 }
 const pageFeature=kind==='gems'?'gem-tiers':'demon-tiers',voteFeature=kind==='gems'?'gem-vote':'demon-vote';
 await requireFeatureAccess(request,env,request.method==='PUT'?[pageFeature,voteFeature]:[pageFeature],account);
 let token=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)__Host-tier_voter=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(!account&&!token)token=Array.from(crypto.getRandomValues(new Uint8Array(32)),value=>value.toString(16).padStart(2,'0')).join('');
 const voter=account?'account:'+account.id:token;
 if(request.method==='PUT'){
  if(request.headers.get('Origin')!==new URL(request.url).origin)return reply({error:'요청 출처를 확인해 주세요.'},403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'JSON 요청이 필요합니다.'},415);
  const reader=request.body?.getReader();if(!reader)return reply({error:'투표 내용이 없습니다.'},400);let size=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32768){await reader.cancel();return reply({error:'투표 크기가 너무 큽니다.'},413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}let input;try{input=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply({error:'투표 형식을 확인해 주세요.'},400);}
  if(input.ballot?.format!==Worldcup.FORMAT||!awards(input.ballot,items,true))
   return reply({error:'모든 대결을 마친 월드컵 결과를 제출해 주세요.'},400);
  const ballot={format:Worldcup.FORMAT,seed:input.ballot.seed,picks:input.ballot.picks,finalRanking:Worldcup.replay(input.ballot,items).finalRanking};
  await db.prepare('INSERT INTO '+table+'(voter,ballot,updated_at) VALUES(?,?,?) ON CONFLICT(voter) DO UPDATE SET ballot=excluded.ballot,updated_at=excluded.updated_at').bind(voter,JSON.stringify(ballot),Date.now()).run();
 }
 const saved=await db.prepare('SELECT voter,ballot FROM '+table).all();let mine=null;const ballots=[];for(const r of saved.results){try{const b=JSON.parse(r.ballot);if(validateBallot(b,items)){ballots.push(b);if(r.voter===voter)mine=b;}}catch{}}
 const access=await accessDecision(request,env,[voteFeature],account);
 const response=reply({total:ballots.length,rows:tally(ballots,items),mine,canVote:access.allowed,loginRequired:!!access.loginRequired});
 if(!account)response.headers.set('Set-Cookie','__Host-tier_voter='+token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000');
 return response;
 }catch(error){return reply({error:error.status?error.message:'투표를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'},error.status||503);}}
