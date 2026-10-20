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
async function session(request,env){
 const token=cookies(request)[SESSION];if(!env.DB||!token||!/^[a-f0-9]{64}$/.test(token))return null;
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
function validBoard(s){
 if(!s||s.version!==2||!['normal','hard','hell','abyss','deepsea'].includes(s.mode)||typeof s.target!=='string'||!s.target.startsWith(s.mode+':')||!Array.isArray(s.cells)||s.cells.length>40||!s.you?.perDemon||!s.partner?.perDemon)throw fail('올바른 배치 세팅이 아닙니다.');
 const keys=new Set();for(const c of s.cells){if(!Number.isInteger(c.row)||c.row<0||c.row>10||c.row===5||!Number.isInteger(c.col)||c.col<0||c.col>6||typeof c.slug!=='string'||c.slug.length>80||keys.has(c.row+','+c.col))throw fail('배치 위치를 확인해 주세요.');keys.add(c.row+','+c.col);}
}
export async function handleAuth({request,env}){
 const path=new URL(request.url).pathname;
 try{
  if(path==='/api/auth/session'&&request.method==='GET'){
   const user=await session(request,env);return reply({ready:ready(env),user:user?{id:user.id,nickname:user.nickname}:null,csrf:user?.csrf||null});
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
   if(!profileResponse.ok||profile.resultcode!=='00'||typeof profile.response?.id!=='string'||profile.response.id.length>200)throw fail('네이버 계정을 확인하지 못했습니다.',502);
   const now=Date.now(),userId=crypto.randomUUID(),nickname=String(profile.response.nickname||'네이버 계정').slice(0,40);
   const user=await env.DB.prepare('INSERT INTO lab_users(id,naver_id,nickname,created_at) VALUES(?,?,?,?) ON CONFLICT(naver_id) DO UPDATE SET nickname=excluded.nickname RETURNING id,nickname').bind(userId,profile.response.id,nickname,now).first();
   const sessionToken=random(),csrf=random(),oldToken=cookies(request)[SESSION];
   const statements=[env.DB.prepare('DELETE FROM lab_sessions WHERE expires_at<=?').bind(now)];
   if(oldToken&&/^[a-f0-9]{64}$/.test(oldToken))statements.push(env.DB.prepare('DELETE FROM lab_sessions WHERE token_hash=?').bind(await hash(oldToken)));
   statements.push(env.DB.prepare('INSERT INTO lab_sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)').bind(await hash(sessionToken),user.id,csrf,now+30*86400000));await env.DB.batch(statements);
   return redirect('/?login=success',[cookie(STATE,'',0),cookie(SESSION,sessionToken,30*86400)]);
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
  if(!write){const row=await env.DB.prepare('SELECT data,revision,updated_at FROM lab_boards WHERE user_id=?').bind(user.id).first();return reply(row?{board:JSON.parse(row.data),revision:row.revision,updatedAt:row.updated_at}:{board:null,revision:0,updatedAt:null});}
  const input=await body(request);validBoard(input?.board);if(!Number.isInteger(input.revision)||input.revision<0)throw fail('저장 버전을 확인해 주세요.');
  const row=await env.DB.prepare('INSERT INTO lab_boards(user_id,data,revision,updated_at) SELECT ?,?,1,? WHERE ?=0 OR EXISTS(SELECT 1 FROM lab_boards WHERE user_id=?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,revision=lab_boards.revision+1,updated_at=excluded.updated_at WHERE lab_boards.revision=? RETURNING revision,updated_at').bind(user.id,JSON.stringify(input.board),Date.now(),input.revision,user.id,input.revision).first();
  if(!row)throw fail('다른 기기에서 세팅이 변경되었습니다. 다시 비교해 주세요.',409);return reply({revision:row.revision,updatedAt:row.updated_at});
 }catch(error){return reply({error:error.status?error.message:'계정 저장 연결을 확인해 주세요.'},error.status||503);}
}
