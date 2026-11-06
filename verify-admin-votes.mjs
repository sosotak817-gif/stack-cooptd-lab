import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {handleTierVotes} from './server/tier-votes.mjs';
import {handleAdmin,requireAdmin} from './server/admin.mjs';
import {roster as gems} from './server/gem-tier-roster.mjs';
import {roster as demons} from './server/tier-roster.mjs';
import fs from 'node:fs';
import Worldcup from './ui/worldcup-core.js';
import {accessSettings,saveAccess} from './server/feature-access.mjs';
function completed(items){const ballot=Worldcup.create(items,()=>.75);let result;while(!(result=Worldcup.replay(ballot,items)).complete)ballot.picks.push(result.next.left);return ballot;}

const routes=JSON.parse(fs.readFileSync('dist/_routes.json','utf8'));
assert.ok(routes.include.includes('/admin/*'),'admin pages must pass through authentication');
assert.ok(routes.include.includes('/admin'),'admin entry without a slash must also be protected');
const sql=new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE lab_users(id TEXT PRIMARY KEY,nickname TEXT);
 CREATE TABLE lab_sessions(token_hash TEXT,csrf TEXT,expires_at INTEGER,user_id TEXT);
 CREATE TABLE lab_pin_credentials(user_id TEXT,nickname_normalized TEXT UNIQUE);
 CREATE TABLE gem_tier_votes(voter TEXT PRIMARY KEY,ballot TEXT,updated_at INTEGER);
 CREATE TABLE tier_votes(voter TEXT PRIMARY KEY,ballot TEXT,updated_at INTEGER);`);
const tokens=new Map();
for(const [index,id,nickname]of [[1,'admin','스택'],[2,'regular','사용자'],[3,'impostor','스택']]){
 const token=String(index).repeat(64);
 tokens.set(id,token);
 sql.prepare('INSERT INTO lab_users VALUES (?,?)').run(id,nickname);
 sql.prepare('INSERT INTO lab_sessions VALUES (?,?,?,?)').run(createHash('sha256').update(token).digest('hex'),'csrf',Date.now()+3600000,id);
}
sql.prepare('INSERT INTO lab_pin_credentials VALUES (?,?)').run('admin','스택');
sql.prepare('INSERT INTO gem_tier_votes VALUES (?,?,?)').run('legacy',JSON.stringify(gems.slice(0,7)),0);
sql.prepare('INSERT INTO tier_votes VALUES (?,?,?)').run('legacy',JSON.stringify(demons.slice(0,7)),0);
function prepare(query,values=[]){
 return {bind:(...args)=>prepare(query,args),first:async()=>sql.prepare(query).get(...values)||null,
  all:async()=>({results:sql.prepare(query).all(...values)}),
  run:async()=>/^\s*SELECT\b/i.test(query)?{results:sql.prepare(query).all(...values)}:{meta:sql.prepare(query).run(...values)}};
}
const DB={prepare,batch:async statements=>{
 sql.exec('BEGIN');
 try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results;}
 catch(error){sql.exec('ROLLBACK');throw error;}
}};
const env={DB},origin='https://lab.test';
function request(path,id,method='GET',body,csrf=true){
 return new Request(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',
  ...(id?{Cookie:'__Host-stack_session='+tokens.get(id),'X-Account-Id':id,...(csrf?{'X-CSRF-Token':'csrf'}:{})}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
}
const vote=(id,kind='gems',method='GET')=>handleTierVotes({env,request:request('/api/tier-votes?kind='+kind,id,method,method==='PUT'?{ballot:completed(kind==='gems'?gems:demons)}:undefined)});
assert.equal((await (await vote()).json()).total,0);
const access=await accessSettings(DB);
await saveAccess(DB,{...access,features:access.features.map(feature=>({...feature,guest:['gem-vote','demon-vote'].includes(feature.id)?false:feature.guest}))});

assert.equal((await vote(undefined,'gems','PUT')).status,401);
assert.equal((await vote(undefined,'demons','PUT')).status,401);
assert.equal((await vote('regular','gems','PUT')).status,200);
const short=completed(gems);short.picks.pop();
assert.equal((await handleTierVotes({env,request:request('/api/tier-votes?kind=gems','regular','PUT',{ballot:short})})).status,400);
assert.equal((await handleTierVotes({env,request:request('/api/tier-votes?kind=gems','regular','PUT',{ranking:gems.slice(0,7)})})).status,400);

sql.exec(fs.readFileSync('migrations/0024_gem_vote_login_reset.sql','utf8'));
assert.equal((await (await vote('regular')).json()).total,1,'one-time reset preserves subsequent votes');
assert.equal((await (await vote(undefined,'demons')).json()).total,1,'gem reset preserves demon votes');
for(const id of ['regular','impostor']){
 assert.equal((await handleAdmin({env,request:request('/api/admin',id)})).status,403);
 await assert.rejects(()=>requireAdmin(request('/admin/',id),env),error=>error.status===403);
}
assert.equal((await handleAdmin({env,request:request('/api/admin')})).status,401);
assert.equal((await handleAdmin({env,request:request('/api/admin','admin')})).status,200);
assert.equal((await handleAdmin({env,request:request('/api/admin','admin','POST',{action:'reset-votes',kind:'gems'},false)})).status,403);
const listVotes=async(kind='gems',offset=0)=>handleAdmin({env,request:request('/api/admin?view=votes&kind='+kind+'&offset='+offset,'admin')});
const listed=await (await listVotes()).json();
assert.equal(listed.total,1);assert.equal(listed.votes[0].nickname,'사용자');
assert.equal(listed.votes[0].format,'worldcup');
assert.equal(listed.votes[0].worldcup.placements.length,gems.length);
assert.ok(listed.votes[0].worldcup.matches.some(match=>match.phase==='placement'));
assert.equal((await (await listVotes('demons')).json()).votes[0].nickname,'비회원 (기존 투표)');
const deletion={action:'delete-vote',kind:'gems',voter:listed.votes[0].voter,updatedAt:listed.votes[0].updatedAt};
assert.equal((await handleAdmin({env,request:request('/api/admin','regular','POST',deletion)})).status,403);
assert.equal((await handleAdmin({env,request:request('/api/admin','admin','POST',deletion,false)})).status,403);
sql.prepare('UPDATE gem_tier_votes SET updated_at=updated_at+1 WHERE voter=?').run(deletion.voter);
assert.equal((await handleAdmin({env,request:request('/api/admin','admin','POST',deletion)})).status,409);
deletion.updatedAt++;
assert.equal((await handleAdmin({env,request:request('/api/admin','admin','POST',deletion)})).status,200);
assert.equal((await (await listVotes()).json()).total,0);
assert.equal((await (await listVotes('demons')).json()).total,1);
for(let i=0;i<51;i++)sql.prepare('INSERT INTO gem_tier_votes VALUES (?,?,?)').run('legacy-'+i,JSON.stringify(gems.slice(0,7)),i);
const secondPage=await (await listVotes('gems',50)).json();assert.equal(secondPage.total,51);assert.equal(secondPage.votes.length,1);

assert.equal((await handleAdmin({env,request:request('/api/admin','admin','POST',{action:'reset-votes',kind:'gems'})})).status,200);
assert.equal((await (await vote()).json()).total,0);
assert.equal((await requireAdmin(request('/admin/','admin'),env)).id,'admin');
const query=await handleAdmin({env,request:request('/api/admin','admin','POST',{action:'sql',sql:'SELECT count(*) AS count FROM lab_users'})});
assert.equal((await query.json()).results[0].count,3);
const {onRequest:adminPage}=await import('./functions/admin/[[path]].js');
const next=async()=>new Response('admin-page');
assert.equal((await adminPage({env,request:request('/admin/','regular'),next})).status,403);
const page=await adminPage({env,request:request('/admin/','admin'),next});
assert.equal(await page.text(),'admin-page');
assert.match(page.headers.get('Cache-Control'),/no-store/);
console.log('Configured login-only votes, one-time gem reset, administrator identity, access controls and CSRF passed.');
