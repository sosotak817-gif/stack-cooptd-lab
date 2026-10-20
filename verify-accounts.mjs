import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { handleAuth,handleBoard } from './server/accounts.mjs';
const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('migrations/0002_accounts.sql','utf8'));
class Statement{
 constructor(query,values=[]){this.query=query;this.values=values;}
 bind(...values){return new Statement(this.query,values);}
 async first(){return sql.prepare(this.query).get(...this.values)||null;}
 async run(){return sql.prepare(this.query).run(...this.values);}
}
const DB={prepare:query=>new Statement(query),async batch(statements){sql.exec('BEGIN');try{for(const s of statements)await s.run();sql.exec('COMMIT');}catch(error){sql.exec('ROLLBACK');throw error;}}};
const env={DB,NAVER_CLIENT_ID:'test-client',NAVER_CLIENT_SECRET:'test-secret',NAVER_REDIRECT_URI:'https://lab.example/api/auth/callback'},origin='https://lab.example';
const request=(path,options={})=>new Request(origin+path,{...options,headers:{Origin:origin,'Content-Type':'application/json',...options.headers}});
const cookieOf=(response,key)=>response.headers.getSetCookie().find(s=>s.startsWith(key+'='))?.split(';')[0];
let profile='naver-one',calls=0;const oldFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{calls++;if(url==='https://nid.naver.com/oauth2.0/token'){assert.equal(options.method,'POST');assert.equal(options.body.get('client_secret'),'test-secret');return Response.json({access_token:'private-provider-token'});}assert.equal(url,'https://openapi.naver.com/v1/nid/me');return Response.json({resultcode:'00',response:{id:profile,nickname:'연구원',email:'must-not-store@example.com'}});};
const auth=(path,options)=>handleAuth({env,request:request(path,options)});
const board=(options)=>handleBoard({env,request:request('/api/account/board',options)});
async function login(){const start=await auth('/api/auth/naver'),location=new URL(start.headers.get('Location')),state=location.searchParams.get('state'),stateCookie=cookieOf(start,'__Host-stack_oauth');assert.equal(location.origin,'https://nid.naver.com');assert.match(state,/^[a-f0-9]{64}$/);assert.ok(start.headers.get('Set-Cookie').includes('HttpOnly; Secure; SameSite=Lax'));const done=await auth('/api/auth/callback?'+new URLSearchParams({state,code:'test-code'}),{headers:{Cookie:stateCookie}});assert.equal(done.status,302);assert.equal(done.headers.get('Location'),'/?login=success');const cookie=cookieOf(done,'__Host-stack_session');assert.ok(cookie);const current=await (await auth('/api/auth/session',{headers:{Cookie:cookie}})).json();assert.ok(current.user&&current.csrf);return {cookie,...current};}
try{
 assert.deepEqual(await (await handleAuth({env:{},request:request('/api/auth/session')})).json(),{ready:false,user:null,csrf:null});
 assert.equal((await handleAuth({env:{},request:request('/api/auth/naver')})).headers.get('Location'),'/?login_error=unavailable');
 assert.equal((await auth('/api/auth/callback?state=bad&code=x')).headers.get('Location'),'/?login_error=cancelled');assert.equal(calls,0);
 const one=await login();assert.equal(sql.prepare('SELECT COUNT(*) n FROM lab_users').get().n,1);assert.ok(!JSON.stringify(one).includes('private-provider-token'));assert.ok(!JSON.stringify(sql.prepare('SELECT * FROM lab_users').get()).includes('must-not-store'));
 const sample={version:2,mode:'hell',target:'hell:SpecialBoss:100:0',cells:[{row:6,col:3,slug:'ivy'}],you:{perDemon:{}},partner:{perDemon:{}}};
 const headers={Cookie:one.cookie,'X-CSRF-Token':one.csrf},put=(revision,change={})=>({method:'PUT',headers,body:JSON.stringify({board:sample,revision,...change})});
 assert.equal((await board()).status,401);assert.equal((await board({method:'PUT',headers:{Cookie:one.cookie},body:'{}'})).status,403);
 assert.equal((await board({...put(0),headers:{...headers,Origin:'https://evil.example'}})).status,403);
 assert.equal((await board({...put(0),body:'{'})).status,400);assert.equal((await board({...put(0),body:' '.repeat(256001)})).status,413);
 assert.equal((await board(put(0,{board:{}}))).status,400);assert.equal((await board(put(-1))).status,400);
 assert.equal((await board({method:'POST'})).status,405);
 assert.equal((await (await board({headers})).json()).board,null);
 assert.equal((await (await board(put(0))).json()).revision,1);
 assert.equal((await board(put(0))).status,409);assert.equal((await (await board(put(1))).json()).revision,2);
 const loaded=await (await board({headers})).json();assert.deepEqual(loaded.board,sample);assert.equal(loaded.revision,2);
 profile='naver-two';const two=await login(),otherHeaders={Cookie:two.cookie,'X-CSRF-Token':two.csrf};assert.equal((await (await board({headers:otherHeaders})).json()).board,null);
 assert.equal((await board({...put(2),headers:otherHeaders})).status,409,'another account cannot overwrite a revision belonging to the first');
 assert.equal((await board({...put(0),headers:otherHeaders})).status,200);assert.equal(sql.prepare('SELECT COUNT(*) n FROM lab_boards').get().n,2);
 assert.equal((await auth('/api/auth/logout',{method:'POST',headers:{Cookie:one.cookie}})).status,403);
 assert.equal((await auth('/api/auth/logout',{method:'POST',headers})).status,200);assert.equal((await (await auth('/api/auth/session',{headers})).json()).user,null);
 sql.prepare('UPDATE lab_sessions SET expires_at=0').run();assert.equal((await board({headers:otherHeaders})).status,401);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM lab_boards').get().n,2,'logout and expiry preserve account saves');
 console.log('Accounts: OAuth state, server-only token exchange, secure sessions, CSRF, real SQLite saves, conflict handling, account isolation, logout and expiry passed.');
}finally{globalThis.fetch=oldFetch;sql.close();}
