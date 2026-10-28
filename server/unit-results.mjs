import {revision} from './unit-calculation-version.mjs';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const schemas=new WeakMap();
async function schema(db){if(!schemas.has(db))schemas.set(db,db.batch([db.prepare('CREATE TABLE IF NOT EXISTS lab_unit_results(owner TEXT NOT NULL,revision TEXT NOT NULL,cache_key TEXT NOT NULL,result TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(owner,revision,cache_key))'),db.prepare('CREATE INDEX IF NOT EXISTS lab_unit_results_age ON lab_unit_results(updated_at)')]).catch(error=>{schemas.delete(db);throw error;}));await schemas.get(db);}
const hex=value=>/^[a-f0-9]{64}$/.test(value||'');
async function owner(request){const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token)return null;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),v=>v.toString(16).padStart(2,'0')).join('');}
function valid(r){return r&&r.revision===revision&&Number.isInteger(r.evaluated)&&r.evaluated>=0&&r.evaluated<=100000&&Number.isFinite(r.updatedAt)&&Array.isArray(r.rankings)&&r.rankings.length<=5&&r.rankings.every(row=>Number.isFinite(row.dps)&&row.dps>=0&&Array.isArray(row.gems)&&row.gems.length===3&&row.gems.every(g=>g===null||typeof g?.id==='string'&&/^[a-z0-9-]{1,64}$/.test(g.id)&&g.grade==='SSS'))&&(!r.freezeProfile||Number.isFinite(r.freezeProfile.share)&&r.freezeProfile.share>=0&&r.freezeProfile.share<=1&&Array.isArray(r.freezeProfile.sources)&&r.freezeProfile.sources.every(c=>typeof c.source==='string'&&Number.isFinite(c.seconds)&&Number.isFinite(c.rate)&&Number.isFinite(c.chance)));}
async function readBody(request){if(!request.headers.get('Content-Type')?.startsWith('application/json'))return null;const reader=request.body?.getReader();if(!reader)return null;let size=0,parts=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>131072){await reader.cancel();return null;}parts.push(value);}const bytes=new Uint8Array(size);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{return null;}}
export async function handleUnitResults({request,env,waitUntil}){
 try{
  const url=new URL(request.url),key=url.searchParams.get('key');if(!hex(key))return reply({error:'계산 조건 키가 올바르지 않습니다.'},400);
  if(url.searchParams.get('revision')!==revision)return reply({error:'계산 기준이 변경되었습니다.',revision},409);
  if(!['GET','PUT'].includes(request.method))return reply({error:'지원하지 않는 요청입니다.'},405);
  const db=env.DB;if(!db)return reply({error:'DB 연결 전에는 기기 저장 결과를 사용합니다.'},503);await schema(db);
  const who=await owner(request),now=Date.now();
  if(request.method==='GET'){
   // Shared rows are written exclusively from this deployment's generated asset.
   const row=await db.prepare('SELECT result,updated_at,owner FROM lab_unit_results WHERE revision=? AND cache_key=? AND owner IN (?,?) ORDER BY CASE WHEN owner=\'shared\' THEN 0 ELSE 1 END LIMIT 1').bind(revision,key,'shared',who||'shared').first();
   if(row){const result=JSON.parse(row.result);if(valid(result))return reply({result,source:row.owner==='shared'?'shared-db':'personal-db',updatedAt:row.updated_at});}
   if(env.ASSETS){const response=await env.ASSETS.fetch(new Request(new URL('/unit-top-defaults.json',url)));if(response.ok){const defaults=await response.json(),result=defaults.revision===revision?defaults.entries?.[key]:null;if(valid(result)){await db.prepare('INSERT INTO lab_unit_results(owner,revision,cache_key,result,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner,revision,cache_key) DO UPDATE SET result=excluded.result,updated_at=excluded.updated_at').bind('shared',revision,key,JSON.stringify(result),result.updatedAt).run();return reply({result,source:'shared-db',updatedAt:result.updatedAt});}}}
   return reply({result:null,revision});
  }
  if(request.headers.get('Origin')!==url.origin)return reply({error:'사이트에서 직접 저장해 주세요.'},403);
  if(!who)return reply({error:'기기 저장 식별자가 필요합니다.'},401);
  const data=await readBody(request);if(!data||!valid(data.result))return reply({error:'계산 결과 형식을 확인해 주세요.'},400);
  // Client results are private to this browser identity and never promoted to shared.
  const result={kind:'top',revision,updatedAt:now,evaluated:data.result.evaluated,total:data.result.total,lib:data.result.lib,freezeProfile:data.result.freezeProfile,rankings:data.result.rankings.map(r=>({dps:r.dps,key:r.key,gems:r.gems}))};
  const stored=await db.prepare('INSERT INTO lab_unit_results(owner,revision,cache_key,result,updated_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM lab_unit_results)<5000 OR EXISTS(SELECT 1 FROM lab_unit_results WHERE owner=? AND revision=? AND cache_key=?) ON CONFLICT(owner,revision,cache_key) DO UPDATE SET result=excluded.result,updated_at=excluded.updated_at RETURNING cache_key').bind(who,revision,key,JSON.stringify(result),now,who,revision,key).first();if(!stored)return reply({error:'DB 캐시가 가득 차 기기 저장을 사용합니다.'},503);
  const cleanup=db.batch([db.prepare('DELETE FROM lab_unit_results WHERE owner=? AND rowid NOT IN (SELECT rowid FROM lab_unit_results WHERE owner=? ORDER BY updated_at DESC LIMIT 80)').bind(who,who),db.prepare('DELETE FROM lab_unit_results WHERE rowid IN (SELECT rowid FROM lab_unit_results WHERE updated_at<? LIMIT 100)').bind(now-90*86400000)]).catch(()=>{});if(waitUntil)waitUntil(cleanup);else await cleanup;
  return reply({saved:true,updatedAt:now});
 }catch{return reply({error:'DB를 사용할 수 없어 기기 계산을 계속합니다.'},503);}
}
