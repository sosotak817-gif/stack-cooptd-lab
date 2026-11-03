import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { handleAuth,handleBoard,handleDecks,handleSettings } from './server/accounts.mjs';
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');sql.exec(fs.readFileSync('migrations/0002_accounts.sql','utf8'));sql.exec(fs.readFileSync('migrations/0010_account_board_backups.sql','utf8'));
class Statement{
 constructor(query,values=[]){this.query=query;this.values=values;}
 bind(...values){return new Statement(this.query,values);}
 async first(){return sql.prepare(this.query).get(...this.values)||null;}
 async all(){return {results:sql.prepare(this.query).all(...this.values)};}
 async run(){const result=sql.prepare(this.query).run(...this.values);return {...result,meta:{changes:result.changes}};}
}
const DB={prepare:query=>new Statement(query),async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(error){sql.exec('ROLLBACK');throw error;}}};
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
 const revised={...sample,cells:[]};
 assert.equal((await board(put(2,{board:revised}))).status,200);
 const previous=sql.prepare('SELECT * FROM lab_board_backups WHERE user_id=?').get(one.user.id);
 assert.equal(previous.revision,2);
 assert.deepEqual(JSON.parse(previous.data),sample);
 assert.equal((await board(put(2))).status,409);
 assert.deepEqual(sql.prepare('SELECT * FROM lab_board_backups WHERE user_id=?').get(one.user.id),previous);
 const backup = options=>handleBoard({env,request:request('/api/account/board?backup=1',options)});
 assert.deepEqual((await (await backup({headers})).json()).backup,{
  revision:2,updatedAt:previous.updated_at,currentRevision:3
 });
 const restore=(revision,backupRevision)=>({method:'PUT',headers,body:JSON.stringify({revision,backupRevision})});
 assert.equal((await backup(restore(2,2))).status,409);
 assert.equal((await backup(restore(3,1))).status,409);
 assert.equal((await backup(restore(3,2))).status,200);
 assert.deepEqual((await (await board({headers})).json()).board,sample);
 assert.deepEqual(JSON.parse(sql.prepare('SELECT data FROM lab_board_backups WHERE user_id=?').get(one.user.id).data),revised);
 profile='naver-two';const two=await login(),otherHeaders={Cookie:two.cookie,'X-CSRF-Token':two.csrf};assert.equal((await (await board({headers:otherHeaders})).json()).board,null);
 assert.equal((await board({headers:{...otherHeaders,'X-Account-Id':one.user.id}})).status,409);
 assert.equal((await board({...put(0),headers:{...otherHeaders,'X-Account-Id':one.user.id}})).status,409);
 assert.equal((await board({...put(2),headers:otherHeaders})).status,409,'another account cannot overwrite a revision belonging to the first');
 assert.equal((await board({...put(0),headers:otherHeaders})).status,200);assert.equal(sql.prepare('SELECT COUNT(*) n FROM lab_boards').get().n,2);
 assert.equal((await auth('/api/auth/logout',{method:'POST',headers:{Cookie:one.cookie}})).status,403);
 assert.equal((await auth('/api/auth/logout',{method:'POST',headers})).status,200);assert.equal((await (await auth('/api/auth/session',{headers})).json()).user,null);
 sql.exec(fs.readFileSync('migrations/0011_account_decks.sql','utf8'));
 sql.exec(fs.readFileSync('migrations/0013_account_deck_backups.sql','utf8'));
 const decks=(method,id,payload,sessionHeaders=otherHeaders,accountId=two.user.id)=>handleDecks({env,request:request('/api/me/decks'+(id?'/'+id:''),{
  method,headers:{...sessionHeaders,'X-Account-Id':accountId},body:payload?JSON.stringify(payload):undefined
 })});
 const deckInput={accountId:two.user.id,name:'첫 번째 덱',board:sample};
 assert.equal((await decks('POST',null,{...deckInput,accountId:one.user.id})).status,409);
 const created=await decks('POST',null,deckInput);
 assert.equal(created.status,201);
 const {deck:{id:deckId}}=await created.json();
 assert.equal((await decks('POST',null,{...deckInput,name:'두 번째 덱'})).status,201);
 assert.equal((await (await decks('GET')).json()).decks.length,2);
 assert.deepEqual((await (await decks('GET',deckId)).json()).deck.board,sample);
 profile='naver-one';
 const freshOne=await login();
 const otherDeckHeaders={Cookie:freshOne.cookie,'X-CSRF-Token':freshOne.csrf};
 assert.equal((await decks('GET',null,null,otherDeckHeaders)).status,409);
 assert.equal((await decks('GET',deckId,null,otherDeckHeaders)).status,409);
 assert.equal((await decks('GET',deckId,null,otherDeckHeaders,freshOne.user.id)).status,404);
 assert.equal((await decks('DELETE',deckId,{accountId:freshOne.user.id,revision:1},otherDeckHeaders,freshOne.user.id)).status,409);
 assert.equal((await decks('PUT',deckId,{...deckInput,name:'수정한 덱',revision:1})).status,200);
 assert.equal((await decks('DELETE',deckId,{accountId:two.user.id,revision:1})).status,409);
 const deckBackup=sql.prepare('SELECT * FROM lab_deck_backups WHERE deck_id=?').get(deckId);
 assert.equal(deckBackup.revision,1);
 assert.equal(deckBackup.name,deckInput.name);
 assert.deepEqual(JSON.parse(deckBackup.data),sample);
 assert.equal((await decks('PUT',deckId,{...deckInput,name:'stale write',revision:1})).status,409);
 assert.deepEqual(sql.prepare('SELECT * FROM lab_deck_backups WHERE deck_id=?').get(deckId),deckBackup);
 assert.equal((await decks('DELETE',deckId,{accountId:two.user.id,revision:2})).status,200);
 assert.equal(sql.prepare('SELECT * FROM lab_deck_backups WHERE deck_id=?').get(deckId),undefined);
 assert.equal((await (await decks('GET')).json()).decks.length,1);
 sql.exec(fs.readFileSync('migrations/0012_account_settings.sql','utf8'));
 const settings={version:1,you:sample.you,partner:sample.partner,inventory:{you:[],partner:[]},cells:sample.cells};
 const settingsCall=(method,activeHeaders,accountId,payload)=>handleSettings({env,request:request('/api/me/settings',{
  method,headers:{...activeHeaders,'X-Account-Id':accountId},body:payload?JSON.stringify(payload):undefined
 })});
 assert.equal((await settingsCall('PUT',otherHeaders,one.user.id,{revision:0,settings})).status,409);
 assert.equal((await settingsCall('PUT',otherHeaders,two.user.id,{revision:0,settings})).status,200);
 assert.equal((await settingsCall('PUT',otherHeaders,two.user.id,{revision:0,settings})).status,409);
 const settingsRead=await (await settingsCall('GET',otherHeaders,two.user.id)).json();
 assert.equal(settingsRead.revision,1);
 assert.deepEqual(settingsRead.settings,{version:1,you:sample.you,partner:sample.partner,inventory:{you:[],partner:[]}});
 assert.equal((await (await settingsCall('GET',otherDeckHeaders,freshOne.user.id)).json()).settings,null);
 sql.exec(fs.readFileSync('migrations/0014_account_puzzle_scores.sql','utf8'));
 const {onRequest:puzzleSubmit}=await import('./functions/api/weekly-puzzle.js');
 const {revision:puzzleRevision}=await import('./server/shared-calculation-version.mjs');
 const submitPuzzle=headers=>puzzleSubmit({env,request:request('/api/weekly-puzzle',{
  method:'POST',headers,body:JSON.stringify({
   day:globalThis.CoopWeekly.dayAt(),revision:puzzleRevision,score:1,moves:0,steps:[],nickname:'spoofed'
  })
 })});
 assert.equal((await submitPuzzle({...otherHeaders,'X-CSRF-Token':'incorrect'})).status,403);
 assert.equal((await submitPuzzle(otherHeaders)).status,200);
 assert.equal(sql.prepare('SELECT user_id FROM daily_puzzle_account_scores').get().user_id,two.user.id);
 assert.equal((await (await submitPuzzle(otherHeaders)).json()).improved,false);
 sql.prepare('UPDATE lab_sessions SET expires_at=0').run();assert.equal((await board({headers:otherHeaders})).status,401);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM lab_boards').get().n,2,'logout and expiry preserve account saves');
 sql.exec(fs.readFileSync('migrations/0009_pin_account_credentials.sql','utf8'));
 const pinEnv = {DB, PIN_PEPPER:'a'.repeat(64)};
 const pinRequest = (action, payload, headers={}) => handleAuth({
  env:pinEnv,request:request('/api/auth/'+action,{
   method:'POST',headers:{'CF-Connecting-IP':'192.0.2.1',...headers},body:JSON.stringify(payload)
  })
 });
 const unconfigured = await handleAuth({env:{DB},request:request('/api/auth/login',{
  method:'POST',headers:{'CF-Connecting-IP':'192.0.2.1'},body:'{}'
 })});
 assert.equal(unconfigured.status,503);
 assert.equal((await pinRequest('login',{}, {'CF-Connecting-IP':''})).status,403);
 const input = {nickname:' Ｔest_연구 ',pin:'01234567',pinConfirmation:'01234567'};
 assert.equal((await pinRequest('register',input,{Origin:'https://evil.example'})).status,403);
 assert.deepEqual(await (await pinRequest('nickname',input)).json(),{available:true});
 assert.equal((await pinRequest('register',{...input,pinConfirmation:'11111111'})).status,400);
 const registered = await pinRequest('register',input);
 assert.equal(registered.status,201);
 const pinUser = await registered.json();
 assert.equal(pinUser.user.nickname,'Test_연구');
 assert.match(registered.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Lax/);
 assert.match(sql.prepare('SELECT pin_hash FROM lab_pin_credentials').get().pin_hash,/^pbkdf2-sha256-v1\$/);
 assert.deepEqual(await (await pinRequest('nickname',{nickname:'test_연구'})).json(),{available:false});
 assert.equal((await pinRequest('register',{...input,nickname:'TEST_연구'})).status,409);
 const loggedIn = await pinRequest('login',{nickname:'test_연구',pin:input.pin},{Cookie:cookieOf(registered,'__Host-stack_session')});
 assert.equal(loggedIn.status,200);
 assert.equal((await loggedIn.json()).user.id,pinUser.user.id);
 assert.equal((await (await auth('/api/auth/me',{headers:{Cookie:cookieOf(registered,'__Host-stack_session')}})).json()).user,null);
 assert.equal((await (await auth('/api/auth/me',{headers:{Cookie:cookieOf(loggedIn,'__Host-stack_session')}})).json()).user.id,pinUser.user.id);
 sql.prepare("UPDATE lab_auth_attempts SET attempts=7 WHERE scope='login:nickname'").run();
 assert.equal((await pinRequest('login',{nickname:'test_연구',pin:'12345678'})).status,401);
 assert.equal((await pinRequest('login',{nickname:'TEST_연구',pin:input.pin},{'CF-Connecting-IP':'192.0.2.2'})).status,429);
 sql.prepare("UPDATE lab_auth_attempts SET attempts=30 WHERE scope='login:source' AND attempts>1").run();
 const beforeSourceProbe = sql.prepare("SELECT count(*) n FROM lab_auth_attempts WHERE scope='login:nickname'").get().n;
 assert.equal((await pinRequest('login',{nickname:'Another',pin:input.pin})).status,429);
 assert.equal(sql.prepare("SELECT count(*) n FROM lab_auth_attempts WHERE scope='login:nickname'").get().n,beforeSourceProbe);
 sql.prepare("DELETE FROM lab_auth_attempts WHERE scope='login:source'").run();
 const changeCookie = cookieOf(loggedIn,'__Host-stack_session');
 const changeSession = await (await auth('/api/auth/me',{headers:{Cookie:changeCookie}})).json();
 const changePayload = {pin:input.pin,newPin:'87654321',pinConfirmation:'87654321'};
 const otherSession = await pinRequest('login',{nickname:input.nickname,pin:input.pin});
 // Clear the prior login throttle before opening the second session for this test.
 assert.equal(otherSession.status,429);
 sql.prepare("DELETE FROM lab_auth_attempts WHERE scope='login:nickname'").run();
 const secondSession = await pinRequest('login',{nickname:input.nickname,pin:input.pin});
 assert.equal(secondSession.status,200);
 const secondCookie = cookieOf(secondSession,'__Host-stack_session');
 assert.equal((await pinRequest('change-pin',changePayload,{Cookie:changeCookie})).status,403);
 assert.equal((await pinRequest('change-pin',changePayload,{Cookie:changeCookie,'X-CSRF-Token':changeSession.csrf})).status,200);
 assert.equal((await (await auth('/api/auth/me',{headers:{Cookie:secondCookie}})).json()).user,null);
 assert.equal((await pinRequest('login',{nickname:input.nickname,pin:input.pin})).status,401);
 assert.equal((await pinRequest('login',{nickname:input.nickname,pin:changePayload.newPin})).status,200);
 const recoveryLogin = await pinRequest('login',{nickname:input.nickname,pin:changePayload.newPin});
 assert.equal(recoveryLogin.status,200);
 const recoverySessionCookie = cookieOf(recoveryLogin,'__Host-stack_session');
 const recoverySession = await recoveryLogin.json();
 const devices = (path, method, payload, extra={}) => handleAuth({env:pinEnv,request:request(path,{
  method,headers:{Cookie:recoverySessionCookie,'X-CSRF-Token':recoverySession.csrf,...extra},
  body:payload ? JSON.stringify(payload) : undefined
 })});
 const deviceInput = {name:'테스트 브라우저',pin:changePayload.newPin};
 assert.equal((await devices('/api/devices','POST',deviceInput,{'X-CSRF-Token':'invalid'})).status,403);
 assert.equal((await devices('/api/devices','POST',deviceInput,{Origin:'https://evil.example'})).status,403);
 assert.equal((await devices('/api/devices','GET',null,{Cookie:'invalid'})).status,401);
 const firstDevice = await devices('/api/devices','POST',deviceInput);
 assert.equal(firstDevice.status,201);
 const firstDeviceId = (await firstDevice.json()).id;
 const firstToken = cookieOf(firstDevice,'__Host-stack_recovery');
 const tokenHash=sql.prepare('SELECT token_hash FROM lab_recovery_devices WHERE id=?').get(firstDeviceId).token_hash;
 assert.match(tokenHash,/^[a-f0-9]{64}$/);
 assert.notEqual(firstToken.split('=')[1],tokenHash);
 assert.ok(firstToken);
 assert.match(firstDevice.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Lax/);
 assert.equal((await devices('/api/devices','POST',deviceInput)).status,201);
 assert.equal((await devices('/api/devices','POST',deviceInput)).status,201);
 assert.equal((await devices('/api/devices','POST',deviceInput)).status,409);
 const listed = await (await devices('/api/devices','GET')).json();
 assert.equal(listed.devices.length,3);
 assert.ok(listed.devices.every(device=>!('token_hash' in device)));
 assert.equal((await devices('/api/devices/'+firstDeviceId,'DELETE',deviceInput)).status,200);
 const resetPayload = {nickname:input.nickname,newPin:'11223344',pinConfirmation:'11223344'};
 assert.equal((await pinRequest('reset-pin',resetPayload,{Cookie:firstToken})).status,401);
 const replacement = await devices('/api/devices','POST',deviceInput);
 assert.equal(replacement.status,201);
 const resetCookie = cookieOf(replacement,'__Host-stack_recovery');
 assert.equal((await pinRequest('reset-pin',resetPayload,{Cookie:resetCookie,Origin:'https://evil.example'})).status,403);
 assert.equal((await pinRequest('reset-pin',resetPayload,{Cookie:resetCookie})).status,200);
 assert.equal((await pinRequest('reset-pin',resetPayload,{Cookie:resetCookie})).status,401);
 assert.equal((await (await auth('/api/auth/me',{headers:{Cookie:recoverySessionCookie}})).json()).user,null);
 assert.equal((await pinRequest('login',{nickname:input.nickname,pin:resetPayload.newPin})).status,200);
 console.log('Accounts: OAuth state, server-only token exchange, secure sessions, CSRF, real SQLite saves, conflict handling, account isolation, logout and expiry passed.');
}finally{globalThis.fetch=oldFetch;sql.close();}
