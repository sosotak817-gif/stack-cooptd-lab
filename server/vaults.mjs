import { readBoardBody,validBoard } from './accounts.mjs';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
const TTL=180*86400000;
const schemas=new WeakMap();
async function ensureSchema(db){
 if(!schemas.has(db))schemas.set(db,db.batch([
  db.prepare('CREATE TABLE IF NOT EXISTS lab_vaults(id TEXT PRIMARY KEY,code_hash TEXT NOT NULL UNIQUE,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated_at INTEGER NOT NULL,expires_at INTEGER NOT NULL)'),
  db.prepare('CREATE INDEX IF NOT EXISTS lab_vault_expiry ON lab_vaults(expires_at)'),
  db.prepare('CREATE TABLE IF NOT EXISTS lab_vault_limits(bucket TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires_at INTEGER NOT NULL)')
 ]).catch(error=>{schemas.delete(db);throw error;}));
 await schemas.get(db);
}
function code(){const raw=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();return 'SL-'+raw.match(/.{8}/g).join('-');}
function normalize(value){const raw=String(value||'').trim().replace(/[\s-]/g,'').toUpperCase();if(!/^SL[A-F0-9]{32}$/.test(raw))throw fail('저장소 코드를 확인해 주세요.',401);return raw;}
function origin(request){if(request.headers.get('Origin')!==new URL(request.url).origin)throw fail('요청 출처를 확인할 수 없습니다.',403);}
export async function handleVault({request,env}){
 const url=new URL(request.url);
 try{
  if(url.pathname==='/api/vault/status'&&request.method==='GET'){
   let ready=false;try{ready=!!(env.DB&&await env.DB.prepare('SELECT 1 AS connected').first());}catch{}
   return reply({ready,expiresAfterDays:180});
  }
  if(!['POST','GET','PUT'].includes(request.method))return reply({error:'지원하지 않는 요청입니다.'},405);
  if(!env.DB)throw fail('개인 저장소 연결을 준비 중입니다. 기기 저장은 계속 이용할 수 있습니다.',503);
  const now=Date.now(),db=env.DB;await ensureSchema(db);
  if(request.method==='POST'){
   origin(request);const input=await readBoardBody(request);validBoard(input?.board);
   const day=Math.floor(now/86400000),bucket=await hash('vault-create:'+day+':'+(request.headers.get('CF-Connecting-IP')||'local'));
   const allowed=await db.prepare('INSERT INTO lab_vault_limits(bucket,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 WHERE attempts<5 RETURNING attempts').bind(bucket,(day+2)*86400000).first();
   if(!allowed)throw fail('오늘 생성 가능한 저장소 수를 초과했습니다. 기존 코드를 연결해 주세요.',429);
   await db.batch([db.prepare('DELETE FROM lab_vaults WHERE expires_at<=?').bind(now),db.prepare('DELETE FROM lab_vault_limits WHERE expires_at<=?').bind(now)]);
   const secret=code(),cap=Math.max(1,Math.min(10000,Number.parseInt(env.VAULT_MAX_STORES,10)||2000));
   const saved=await db.prepare('INSERT INTO lab_vaults(id,code_hash,data,revision,updated_at,expires_at) SELECT ?,?,?,1,?,? WHERE (SELECT COUNT(*) FROM lab_vaults)<? RETURNING revision,updated_at,expires_at').bind(crypto.randomUUID(),await hash(normalize(secret)),JSON.stringify(input.board),now,now+TTL,cap).first();
   if(!saved)throw fail('개인 저장소가 가득 찼습니다. 기기 저장이나 기존 코드를 이용해 주세요.',503);
   return reply({code:secret,revision:saved.revision,updatedAt:saved.updated_at,expiresAt:saved.expires_at},201);
  }
  const secret=normalize(request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1]),key=await hash(secret);
  if(request.method==='GET'){
   const row=await db.prepare('UPDATE lab_vaults SET expires_at=? WHERE code_hash=? AND expires_at>? RETURNING data,revision,updated_at,expires_at').bind(now+TTL,key,now).first();
   if(!row)throw fail('코드가 올바르지 않거나 저장소가 만료되었습니다.',404);
   return reply({board:JSON.parse(row.data),revision:row.revision,updatedAt:row.updated_at,expiresAt:row.expires_at});
  }
  origin(request);const input=await readBoardBody(request);validBoard(input?.board);if(!Number.isInteger(input.revision)||input.revision<1)throw fail('저장 버전을 확인해 주세요.');
  const row=await db.prepare('UPDATE lab_vaults SET data=?,revision=revision+1,updated_at=?,expires_at=? WHERE code_hash=? AND revision=? AND expires_at>? RETURNING revision,updated_at,expires_at').bind(JSON.stringify(input.board),now,now+TTL,key,input.revision,now).first();
  if(!row){const exists=await db.prepare('SELECT id FROM lab_vaults WHERE code_hash=? AND expires_at>?').bind(key,now).first();throw fail(exists?'다른 브라우저에서 세팅이 변경되었습니다. 사용할 세팅을 선택해 주세요.':'코드가 올바르지 않거나 저장소가 만료되었습니다.',exists?409:404);}
  return reply({revision:row.revision,updatedAt:row.updated_at,expiresAt:row.expires_at});
 }catch(error){return reply({error:error.status?error.message:'개인 저장소 연결을 확인해 주세요. 기기 저장은 유지됩니다.'},error.status||503);}
}
