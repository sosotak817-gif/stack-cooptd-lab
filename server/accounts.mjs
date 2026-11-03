import { accountSchema } from './account-schema.mjs';
import { changePin, handlePinAuth, pinIdentityPrefix, pinReady, manageRecovery, resetPin } from './pin-auth.mjs';

const jsonHeaders={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:jsonHeaders});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
const SESSION='__Host-stack_session',STATE='__Host-stack_oauth';
const cookie=(key,value,age)=>`${key}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
function cookies(request){return Object.fromEntries((request.headers.get('Cookie')||'').split(';').map(s=>s.trim().split('=')).filter(p=>p.length===2));}
const ready=env=>!!(env.DB&&env.NAVER_CLIENT_ID&&env.NAVER_CLIENT_SECRET&&env.NAVER_REDIRECT_URI);
function callbackURL(env,request){const url=new URL(env.NAVER_REDIRECT_URI);if(url.protocol!=='https:'||url.origin!==new URL(request.url).origin||url.pathname!=='/api/auth/callback'||url.search||url.hash)throw fail('네이버 로그인 주소 설정을 확인해 주세요.',503);return url.href;}
function redirect(location,values=[]){const headers=new Headers({'Location':location,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});for(const value of values)headers.append('Set-Cookie',value);return new Response(null,{status:302,headers});}
const initializedAccounts = new WeakMap();

async function initializeAccounts(db) {
 if (!initializedAccounts.has(db)) {
  const setup = (async () => {
   const installed = await db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='lab_account_schema'").first();
   if (installed && await db.prepare('SELECT 1 FROM lab_account_schema WHERE version=18').first()) return;
   await db.batch([
    ...accountSchema.map(sql => db.prepare(sql)),
    db.prepare('CREATE TABLE IF NOT EXISTS lab_account_schema (version INTEGER PRIMARY KEY)'),
    db.prepare('INSERT OR IGNORE INTO lab_account_schema(version) VALUES (18)')
   ]);
  })();
  initializedAccounts.set(db, setup);
  setup.catch(() => initializedAccounts.delete(db));
 }
 await initializedAccounts.get(db);
}

async function session(request,env){
 const token=cookies(request)[SESSION];if(!env.DB||!token||!/^[a-f0-9]{64}$/.test(token))return null;
 if(pinReady(env))await initializeAccounts(env.DB);
 return env.DB.prepare('SELECT s.token_hash,s.csrf,s.expires_at,u.id,u.nickname FROM lab_sessions s JOIN lab_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await hash(token),Date.now()).first();
}
function sameOrigin(request){if(request.headers.get('Origin')!==new URL(request.url).origin)throw fail('요청 출처를 확인할 수 없습니다.',403);}
async function authorized(request,env,write=false){const user=await session(request,env);if(!user)throw fail('로그인이 필요합니다.',401);if(write){sameOrigin(request);if(request.headers.get('X-CSRF-Token')!==user.csrf)throw fail('로그인 정보를 새로 확인해 주세요.',403);}return user;}
async function body(request){
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw fail('JSON 요청이 필요합니다.',415);
 const reader=request.body?.getReader();if(!reader)throw fail('저장할 세팅이 없습니다.');const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>256000){await reader.cancel();throw fail('세팅 파일은 256KB 이하로 저장해 주세요.',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw fail('세팅 형식을 확인해 주세요.');}
}
export function validBoard(s){
 if(!s||s.version!==2||!['normal','hard','hell','abyss','deepsea'].includes(s.mode)||typeof s.target!=='string'||!s.target.startsWith(s.mode+':')||!Array.isArray(s.cells)||s.cells.length>40||!s.you?.perDemon||!s.partner?.perDemon)throw fail('올바른 배치 세팅이 아닙니다.');
 const keys=new Set();for(const c of s.cells){if(!Number.isInteger(c.row)||c.row<0||c.row>10||c.row===5||!Number.isInteger(c.col)||c.col<0||c.col>6||typeof c.slug!=='string'||c.slug.length>80||keys.has(c.row+','+c.col))throw fail('배치 위치를 확인해 주세요.');keys.add(c.row+','+c.col);}
}
export { body as readBoardBody, authorized as requireAccountSession };
async function issueSession(request, env, user, statements = [], pinHash) {
 const now = Date.now(), token = random(), csrf = random(), oldToken = cookies(request)[SESSION];
 statements.push(env.DB.prepare('DELETE FROM lab_sessions WHERE expires_at<=?').bind(now));
 if(oldToken && /^[a-f0-9]{64}$/.test(oldToken)) {
  statements.push(env.DB.prepare('DELETE FROM lab_sessions WHERE token_hash=?').bind(await hash(oldToken)));
 }
 const sessionValues = [await hash(token),user.id,csrf,now+30*86400000];
 const insert = pinHash
  ? env.DB.prepare('INSERT INTO lab_sessions(token_hash,user_id,csrf,expires_at) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM lab_pin_credentials WHERE user_id=? AND pin_hash=?)').bind(...sessionValues,user.id,pinHash)
  : env.DB.prepare('INSERT INTO lab_sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)').bind(...sessionValues);
 const results = await env.DB.batch([...statements, insert]);
 const result = results.at(-1);
 if (!(result.meta?.changes ?? result.changes)) throw fail('계정 정보가 변경되었습니다. 다시 로그인해 주세요.',409);
 return { csrf, cookie: cookie(SESSION,token,30*86400) };
}
async function startSession(request, env, user, statements, status=200, pinHash) {
 const issued = await issueSession(request, env, user, statements, pinHash);
 const response = reply({user:{id:user.id,nickname:user.nickname},csrf:issued.csrf},status);
 response.headers.append('Set-Cookie',issued.cookie);
 return response;
}
export async function handleAuth({request,env}){
 const path=new URL(request.url).pathname;
 try{
  if(pinReady(env) && ((path==='/api/auth/me' && request.method==='GET') ||
     (request.method==='POST' && /^\/api\/auth\/(nickname|register|login|reset-pin)$/.test(path)))) {
   await initializeAccounts(env.DB);
  }
  const action = path.match(/^\/api\/auth\/(nickname|register|login)$/)?.[1];
  if(action && request.method==='POST'){
   return await handlePinAuth(request,env,action,{body,fail,hash,random,reply,sameOrigin,startSession});
  }
  if((path==='/api/auth/session'||path==='/api/auth/me')&&request.method==='GET'){
   const user=await session(request,env);
   const result={ready:ready(env),user:user?{id:user.id,nickname:user.nickname}:null,csrf:user?.csrf||null};
   if(path==='/api/auth/me'){
    result.pinReady=pinReady(env);
    if(user&&result.pinReady){
     const badge=await env.DB.prepare('SELECT a.code,a.title FROM lab_featured_badges f JOIN lab_achievements a ON a.code=f.code WHERE f.user_id=?').bind(user.id).first();
     result.featuredBadge=badge?.title??null;
     result.featuredBadgeCode=badge?.code??null;
    }
    result.pinAccount=!!(user&&result.pinReady&&await env.DB.prepare('SELECT 1 FROM lab_pin_credentials WHERE user_id=?').bind(user.id).first());
   }
   return reply(result);
  }
  if(path==='/api/auth/naver'&&request.method==='GET'){
   if(!ready(env))return redirect('/?login_error=unavailable');
   const state=random(),url=new URL('https://nid.naver.com/oauth2.0/authorize');url.search=new URLSearchParams({response_type:'code',client_id:env.NAVER_CLIENT_ID,redirect_uri:callbackURL(env,request),state}).toString();
   return redirect(url.href,[cookie(STATE,state,600)]);
  }
  if(path==='/api/auth/callback'&&request.method==='GET'){
   if(!ready(env))return redirect('/?login_error=unavailable',[cookie(STATE,'',0)]);
   callbackURL(env,request);const params=new URL(request.url).searchParams,state=params.get('state'),code=params.get('code');
   if(!state||!/^[a-f0-9]{64}$/.test(state)||state!==cookies(request)[STATE]||!code||params.has('error'))return redirect('/?login_error=cancelled',[cookie(STATE,'',0)]);
   const tokenResponse=await fetch('https://nid.naver.com/oauth2.0/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:env.NAVER_CLIENT_ID,client_secret:env.NAVER_CLIENT_SECRET,code,state,redirect_uri:env.NAVER_REDIRECT_URI}),signal:AbortSignal.timeout(15000)});
   const token=await tokenResponse.json();if(!tokenResponse.ok||!token.access_token)throw fail('네이버 인증을 완료하지 못했습니다.',502);
   const profileResponse=await fetch('https://openapi.naver.com/v1/nid/me',{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(15000)}),profile=await profileResponse.json();
   if(!profileResponse.ok||profile.resultcode!=='00'||typeof profile.response?.id!=='string'||profile.response.id.length>200||profile.response.id.startsWith(pinIdentityPrefix))throw fail('네이버 계정을 확인하지 못했습니다.',502);
   const now=Date.now(),userId=crypto.randomUUID(),nickname=String(profile.response.nickname||'네이버 계정').slice(0,40);
   const user=await env.DB.prepare('INSERT INTO lab_users(id,naver_id,nickname,created_at) VALUES(?,?,?,?) ON CONFLICT(naver_id) DO UPDATE SET nickname=excluded.nickname RETURNING id,nickname').bind(userId,profile.response.id,nickname,now).first();
   const issued = await issueSession(request, env, user);
   return redirect('/?login=success',[cookie(STATE,'',0),issued.cookie]);
  }
  if(path==='/api/auth/reset-pin'&&request.method==='POST'){
   return await resetPin(request,env,{body,fail,hash,random,reply,cookie,cookies,sameOrigin});
  }
  const deviceId = path.match(/^\/api\/devices\/([a-f0-9-]{36})$/)?.[1];
  if((path==='/api/devices'&&['GET','POST'].includes(request.method))||(deviceId&&request.method==='DELETE')){
   const user=await authorized(request,env,request.method!=='GET');
   return await manageRecovery(request,env,user,deviceId,{body,fail,hash,random,reply,cookie,cookies});
  }
  if(path==='/api/auth/change-pin'&&request.method==='POST'){
   const user=await authorized(request,env,true);
   return await changePin(request,env,user,{body,fail,hash,random,reply});
  }
  if(path==='/api/auth/logout'&&request.method==='POST'){
   const user=await authorized(request,env,true);await env.DB.prepare('DELETE FROM lab_sessions WHERE token_hash=?').bind(user.token_hash).run();
   const response=reply({ok:true});response.headers.append('Set-Cookie',cookie(SESSION,'',0));return response;
  }
  return reply({error:'지원하지 않는 요청입니다.'},405);
 }catch(error){if(path==='/api/auth/callback')return redirect('/?login_error=failed',[cookie(STATE,'',0)]);return reply({error:error.status?error.message:'로그인 연결을 확인해 주세요.'},error.status||503);}
}
export async function handleBoard({request,env}){
 try{
  const write=request.method==='PUT';if(!['GET','PUT'].includes(request.method))return reply({error:'지원하지 않는 요청입니다.'},405);
  const user=await authorized(request,env,write);
  const accountId=request.headers.get('X-Account-Id');
  if(accountId!==null&&accountId!==user.id)throw fail('로그인 계정이 변경되었습니다.',409);
  const backup = new URL(request.url).searchParams.get('backup') === '1';
  if(backup && !write){
   const row=await env.DB.prepare(`SELECT b.revision,b.updated_at,current.revision AS current_revision
    FROM lab_board_backups b JOIN lab_boards current ON current.user_id=b.user_id WHERE b.user_id=?`).bind(user.id).first();
   return reply({backup:row?{revision:row.revision,updatedAt:row.updated_at,currentRevision:row.current_revision}:null});
  }
  if(backup){
   const input=await body(request);
   if(!Number.isSafeInteger(input?.revision)||input.revision<1||
      !Number.isSafeInteger(input.backupRevision)||input.backupRevision<1)throw fail('복원할 저장 버전을 확인해 주세요.');
   const row=await env.DB.prepare(`UPDATE lab_boards SET data=backup.data,revision=lab_boards.revision+1,updated_at=?
    FROM lab_board_backups backup
    WHERE lab_boards.user_id=? AND lab_boards.revision=?
      AND backup.user_id=lab_boards.user_id AND backup.revision=?
    RETURNING revision,updated_at`).bind(Date.now(),user.id,input.revision,input.backupRevision).first();
   if(!row)throw fail('복원할 세팅이 변경되었습니다. 다시 비교해 주세요.',409);
   return reply({revision:row.revision,updatedAt:row.updated_at});
  }
  if(!write){const row=await env.DB.prepare('SELECT data,revision,updated_at FROM lab_boards WHERE user_id=?').bind(user.id).first();return reply(row?{board:JSON.parse(row.data),revision:row.revision,updatedAt:row.updated_at}:{board:null,revision:0,updatedAt:null});}
  const input=await body(request);validBoard(input?.board);if(!Number.isInteger(input.revision)||input.revision<0)throw fail('저장 버전을 확인해 주세요.');
  const row=await env.DB.prepare('INSERT INTO lab_boards(user_id,data,revision,updated_at) SELECT ?,?,1,? WHERE ?=0 OR EXISTS(SELECT 1 FROM lab_boards WHERE user_id=?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,revision=lab_boards.revision+1,updated_at=excluded.updated_at WHERE lab_boards.revision=? RETURNING revision,updated_at').bind(user.id,JSON.stringify(input.board),Date.now(),input.revision,user.id,input.revision).first();
  if(!row)throw fail('다른 기기에서 세팅이 변경되었습니다. 다시 비교해 주세요.',409);return reply({revision:row.revision,updatedAt:row.updated_at});
 }catch(error){return reply({error:error.status?error.message:'계정 저장 연결을 확인해 주세요.'},error.status||503);}
}

export async function handleDecks({request,env}) {
 try {
  const path=new URL(request.url).pathname;
  const id=path.match(/^\/api\/me\/decks\/([a-f0-9-]{36})$/)?.[1];
  const method=request.method;
  if ((!id && (path!=='/api/me/decks' || !['GET','POST'].includes(method))) ||
      (id && !['GET','PUT','DELETE'].includes(method))) {
   return reply({error:'지원하지 않는 요청입니다.'},405);
  }
  const user=await authorized(request,env,method!=='GET');
  if(request.headers.get('X-Account-Id')!==user.id)throw fail('로그인 계정이 변경되었습니다.',409);
  const db=env.DB;
  if(method==='GET'){
   if(!id){
    const rows=await db.prepare(`SELECT id,name,revision,created_at,updated_at FROM lab_decks
     WHERE user_id=? ORDER BY updated_at DESC,id`).bind(user.id).all();
    return reply({decks:rows.results});
   }
   const row=await db.prepare(`SELECT id,name,data,revision,created_at,updated_at FROM lab_decks
    WHERE user_id=? AND id=?`).bind(user.id,id).first();
   if(!row)throw fail('저장한 덱을 찾을 수 없습니다.',404);
   const {data,...deck}=row;
   return reply({deck:{...deck,board:JSON.parse(data)}});
  }
  const input=await body(request);
  if(input?.accountId!==user.id)throw fail('로그인 계정이 변경되었습니다.',409);
  if(id&&(!Number.isSafeInteger(input.revision)||input.revision<1))throw fail('덱 버전을 확인해 주세요.');
  if(method==='DELETE'){
   const row=await db.prepare('DELETE FROM lab_decks WHERE user_id=? AND id=? AND revision=? RETURNING id')
    .bind(user.id,id,input.revision).first();
   if(!row)throw fail('덱 목록이 변경되었습니다. 다시 불러와 주세요.',409);
   return reply({ok:true});
  }
  const name=typeof input.name==='string'?input.name.trim():'';
  if(!name||name.length>60||/[\u0000-\u001f\u007f]/.test(name))throw fail('덱 이름을 1~60자로 입력해 주세요.');
  validBoard(input.board);
  const data=JSON.stringify(input.board),now=Date.now();
  if(method==='POST'){
   const row=await db.prepare(`INSERT INTO lab_decks(id,user_id,name,data,created_at,updated_at)
    SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM lab_decks WHERE user_id=?)<30
    RETURNING id,name,revision,created_at,updated_at`).bind(crypto.randomUUID(),user.id,name,data,now,now,user.id).first();
   if(!row)throw fail('덱은 계정당 최대 30개까지 저장할 수 있습니다.',409);
   return reply({deck:row},201);
  }
  const row=await db.prepare(`UPDATE lab_decks SET name=?,data=?,revision=revision+1,updated_at=?
   WHERE user_id=? AND id=? AND revision=? RETURNING id,name,revision,created_at,updated_at`)
   .bind(name,data,now,user.id,id,input.revision).first();
  if(!row)throw fail('덱 목록이 변경되었습니다. 다시 불러와 주세요.',409);
  return reply({deck:row});
 }catch(error){
  return reply({error:error.status?error.message:'계정 덱 저장 연결을 확인해 주세요.'},error.status||503);
 }
}

export async function handleSettings({request,env}) {
 try {
  const write=request.method==='PUT';
  if(!write&&request.method!=='GET')return reply({error:'지원하지 않는 요청입니다.'},405);
  const user=await authorized(request,env,write);
  if(request.headers.get('X-Account-Id')!==user.id)throw fail('로그인 계정이 변경되었습니다.',409);
  const db=env.DB;
  if(!write){
   const row=await db.prepare('SELECT data,revision,updated_at FROM lab_settings WHERE user_id=?').bind(user.id).first();
   return reply(row?{settings:JSON.parse(row.data),revision:row.revision,updatedAt:row.updated_at}:{settings:null,revision:0});
  }
  const input=await body(request);
  const settings=input?.settings;
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
  if(!Number.isSafeInteger(input?.revision)||input.revision<0||settings?.version!==1||
    !object(settings.you)||!object(settings.partner)||!object(settings.you.perDemon)||!object(settings.partner.perDemon)||
    !Array.isArray(settings.inventory?.you)||!Array.isArray(settings.inventory?.partner)){
   throw fail('설정 형식과 저장 버전을 확인해 주세요.');
  }
  const data=JSON.stringify({version:1,you:settings.you,partner:settings.partner,inventory:settings.inventory});
  const row=await db.prepare(`INSERT INTO lab_settings(user_id,data,revision,updated_at)
    SELECT ?,?,1,? WHERE ?=0 OR EXISTS(SELECT 1 FROM lab_settings WHERE user_id=?)
    ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,revision=lab_settings.revision+1,updated_at=excluded.updated_at
    WHERE lab_settings.revision=? RETURNING revision,updated_at`)
   .bind(user.id,data,Date.now(),input.revision,user.id,input.revision).first();
  if(!row)throw fail('다른 기기에서 설정이 변경되었습니다. 다시 확인해 주세요.',409);
  return reply({revision:row.revision,updatedAt:row.updated_at});
 }catch(error){
  return reply({error:error.status?error.message:'계정 설정 연결을 확인해 주세요.'},error.status||503);
 }
}
