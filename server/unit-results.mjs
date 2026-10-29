import {revision} from './unit-calculation-version.mjs';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const schemas=new WeakMap();
async function schema(db){if(!schemas.has(db))schemas.set(db,db.batch([db.prepare('CREATE TABLE IF NOT EXISTS lab_unit_results(owner TEXT NOT NULL,revision TEXT NOT NULL,cache_key TEXT NOT NULL,result TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(owner,revision,cache_key))'),db.prepare('CREATE INDEX IF NOT EXISTS lab_unit_results_age ON lab_unit_results(updated_at)')]).catch(error=>{schemas.delete(db);throw error;}));await schemas.get(db);}
const hex=value=>/^[a-f0-9]{64}$/.test(value||'');
async function owner(request){const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token)return null;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),v=>v.toString(16).padStart(2,'0')).join('');}
function validTop(r){return r&&!r.partial&&r.revision===revision&&Number.isInteger(r.total)&&r.total===r.evaluated&&Number.isInteger(r.evaluated)&&r.evaluated>=0&&r.evaluated<=100000&&Number.isFinite(r.updatedAt)&&Array.isArray(r.rankings)&&r.rankings.length<=5&&r.rankings.every(row=>Number.isFinite(row.dps)&&row.dps>=0&&Array.isArray(row.gems)&&row.gems.length===3&&row.gems.every(g=>g===null||typeof g?.id==='string'&&/^[a-z0-9-]{1,64}$/.test(g.id)&&g.grade==='SSS'))&&(!r.freezeProfile||validFreeze({revision:r.revision,updatedAt:r.updatedAt,profile:r.freezeProfile}));}
async function readBody(request){if(!request.headers.get('Content-Type')?.startsWith('application/json'))return null;const reader=request.body?.getReader();if(!reader)return null;let size=0,parts=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>131072){await reader.cancel();return null;}parts.push(value);}const bytes=new Uint8Array(size);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{return null;}}
function validFreeze(r){const p=r?.profile;return r?.revision===revision&&Number.isFinite(r.updatedAt)&&p&&Number.isFinite(p.share)&&p.share>=0&&p.share<=1&&Number.isFinite(p.stunShare)&&p.stunShare>=0&&p.stunShare<=1&&Array.isArray(p.stunSources)&&p.stunSources.length<=16&&p.stunSources.every(c=>typeof c.source==='string'&&Number.isFinite(c.seconds)&&Number.isFinite(c.rate)&&Number.isFinite(c.chance))&&typeof p.immune==='boolean'&&Number.isFinite(p.extraSeconds)&&Number.isFinite(p.attackSpeed)&&Array.isArray(p.sources)&&p.sources.length<=16&&p.sources.every(c=>typeof c.source==='string'&&Number.isFinite(c.seconds)&&Number.isFinite(c.rate)&&Number.isFinite(c.chance));}
export async function handleFreezeResults(context){return handleUnitResults({...context,resultKind:'freeze'});}
export async function handleUnitResults({request,env,waitUntil,resultKind='top'}){
 const valid=resultKind==='freeze'?validFreeze:validTop,asset=resultKind==='freeze'?'unit-freeze-defaults':'unit-top-defaults';
 try{
  const url=new URL(request.url),key=url.searchParams.get('key');if(!hex(key))return reply({error:'계산 조건 키가 올바르지 않습니다.'},400);
  if(url.searchParams.get('revision')!==revision)return reply({error:'계산 기준이 변경되었습니다.',revision},409);
  if(!['GET','PUT'].includes(request.method))return reply({error:'지원하지 않는 요청입니다.'},405);
  const db=env.DB;if(!db)return reply({error:'DB 연결 전에는 기기 저장 결과를 사용합니다.'},503);await schema(db);
  const who=await owner(request),now=Date.now();
  if(request.method==='GET'){
   // Calculation-only results are shared by revision and condition, including legacy browser rows.
   const row=await db.prepare('SELECT result,updated_at,owner FROM lab_unit_results WHERE revision=? AND cache_key=? ORDER BY CASE WHEN owner=\'shared\' THEN 0 ELSE 1 END,updated_at DESC LIMIT 1').bind(revision,key).first();
   if(row){const result=JSON.parse(row.result);if(valid(result))return reply({result,source:'shared-db',updatedAt:row.updated_at});}
   {const assetRequest=new Request(new URL('/'+asset+'.json',url)),response=await (env.ASSETS?env.ASSETS.fetch(assetRequest):fetch(assetRequest));if(response.ok){const defaults=await response.json(),result=defaults.revision===revision?defaults.entries?.[key]:null;if(valid(result)){await db.prepare('INSERT INTO lab_unit_results(owner,revision,cache_key,result,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner,revision,cache_key) DO UPDATE SET result=excluded.result,updated_at=excluded.updated_at').bind('shared',revision,key,JSON.stringify(result),result.updatedAt).run();return reply({result,source:'shared-db',updatedAt:result.updatedAt});}}}
   return reply({result:null,revision});
  }
  if(request.headers.get('Origin')!==url.origin)return reply({error:'사이트에서 직접 저장해 주세요.'},403);
  if(!who)return reply({error:'기기 저장 식별자가 필요합니다.'},401);
  const storageOwner='shared';
  const data=await readBody(request);if(!data||!valid(data.result))return reply({error:'계산 결과 형식을 확인해 주세요.'},400);
  const existing=await db.prepare('SELECT result,updated_at FROM lab_unit_results WHERE owner=? AND revision=? AND cache_key=?').bind(storageOwner,revision,key).first();if(!data.force&&existing&&valid(JSON.parse(existing.result)))return reply({saved:true,reused:true,updatedAt:existing.updated_at});
  // Persist only numerical calculation output; browser identity and account inputs are not stored.
  const result=resultKind==='freeze'?{kind:'freeze',revision,updatedAt:now,profile:data.result.profile}:{kind:'top',revision,updatedAt:now,evaluated:data.result.evaluated,total:data.result.total,lib:data.result.lib,freezeProfile:data.result.freezeProfile,rankings:data.result.rankings.map(r=>({dps:r.dps,key:r.key,gems:r.gems}))};
  const stored=await db.prepare('INSERT INTO lab_unit_results(owner,revision,cache_key,result,updated_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM lab_unit_results)<5000 OR EXISTS(SELECT 1 FROM lab_unit_results WHERE owner=? AND revision=? AND cache_key=?) ON CONFLICT(owner,revision,cache_key) DO UPDATE SET result=excluded.result,updated_at=excluded.updated_at WHERE ?=1 RETURNING cache_key').bind(storageOwner,revision,key,JSON.stringify(result),now,storageOwner,revision,key,data.force===true?1:0).first();if(!stored){const row=await db.prepare('SELECT updated_at FROM lab_unit_results WHERE owner=? AND revision=? AND cache_key=?').bind(storageOwner,revision,key).first();return row?reply({saved:true,reused:true,updatedAt:row.updated_at}):reply({error:'DB 캐시가 가득 차 기기 저장을 사용합니다.'},503);}
  const cleanup=db.batch([db.prepare('DELETE FROM lab_unit_results WHERE owner=? AND revision<>? AND rowid NOT IN (SELECT rowid FROM lab_unit_results WHERE owner=? ORDER BY updated_at DESC LIMIT 80)').bind(storageOwner,revision,storageOwner),db.prepare('DELETE FROM lab_unit_results WHERE rowid IN (SELECT rowid FROM lab_unit_results WHERE revision<>? AND updated_at<? LIMIT 100)').bind(revision,now-90*86400000)]).catch(()=>{});if(waitUntil)waitUntil(cleanup);else await cleanup;
  return reply({saved:true,updatedAt:now});
 }catch{return reply({error:'DB를 사용할 수 없어 기기 계산을 계속합니다.'},503);}
}
