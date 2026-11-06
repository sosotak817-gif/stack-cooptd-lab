import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {accessSettings,features,featureIdsForRequest} from './server/feature-access.mjs';
import {handleAdmin} from './server/admin.mjs';
import {handleTierVotes} from './server/tier-votes.mjs';
import {onRequest as middleware} from './functions/_middleware.js';
import {onRequest as publicPolicy} from './functions/api/feature-access.js';
import Worldcup from './ui/worldcup-core.js';
import {roster as gems} from './server/gem-tier-roster.mjs';
const sql=new DatabaseSync(':memory:');
sql.exec('CREATE TABLE lab_users(id TEXT PRIMARY KEY,nickname TEXT); CREATE TABLE lab_sessions(token_hash TEXT,csrf TEXT,expires_at INTEGER,user_id TEXT); CREATE TABLE lab_pin_credentials(user_id TEXT,nickname_normalized TEXT UNIQUE);');
const tokens=new Map();
for(const [index,id,nickname]of [[1,'admin','스택'],[2,'regular','일반']]){
 const token=String(index).repeat(64);tokens.set(id,token);
 sql.prepare('INSERT INTO lab_users VALUES (?,?)').run(id,nickname);
 sql.prepare('INSERT INTO lab_sessions VALUES (?,?,?,?)').run(createHash('sha256').update(token).digest('hex'),'csrf',Date.now()+3600000,id);
}
sql.prepare('INSERT INTO lab_pin_credentials VALUES (?,?)').run('admin','스택');
function prepare(query,values=[]){
 return {bind:(...args)=>prepare(query,args),first:async()=>sql.prepare(query).get(...values)||null,
  all:async()=>({results:sql.prepare(query).all(...values)}),
  run:async()=>/^\s*SELECT\b/i.test(query)?{results:sql.prepare(query).all(...values)}:{meta:sql.prepare(query).run(...values)}};
}
let queue=Promise.resolve();
const DB={prepare,batch(statements){
 const task=queue.then(async()=>{sql.exec('BEGIN');try{const values=[];for(const statement of statements)values.push(await statement.run());sql.exec('COMMIT');return values;}catch(error){sql.exec('ROLLBACK');throw error;}});
 queue=task.catch(()=>{});return task;
}};
const env={DB},origin='https://lab.test';
function request(path,id,method='GET',body,cookie,csrf=true){
 return new Request(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',
  ...(id?{Cookie:'__Host-stack_session='+tokens.get(id),'X-Account-Id':id,...(csrf?{'X-CSRF-Token':'csrf'}:{})}:cookie?{Cookie:cookie}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
}
const routes=JSON.parse(fs.readFileSync('dist/_routes.json','utf8'));
for(const feature of features)for(const page of feature.pages||[]){
 assert.ok(routes.include.includes(page),'feature page must be routed through access middleware: '+page);
 if(page!=='/')assert.ok(routes.include.includes(page+'/*'));
}
const settings=await accessSettings(DB);
assert.equal(settings.features.length,features.length);
assert.equal(settings.features.find(feature=>feature.id==='gem-vote').guest,true);
assert.equal(settings.features.find(feature=>feature.id==='saved-decks').guest,false);
assert.deepEqual(featureIdsForRequest('/growth/index.html'),['growth']);
assert.deepEqual(featureIdsForRequest('/gr%6fwth/'),['growth']);
assert.deepEqual(featureIdsForRequest('/api/tier-votes/','PUT','gems'),['gem-tiers','gem-vote']);
assert.deepEqual(featureIdsForRequest('/api/weekly-puzzle','POST','demons','weekly'),['puzzle','weekly-submit']);
const ballot=Worldcup.create(gems,()=>.75);let state;
while(!(state=Worldcup.replay(ballot,gems)).complete)ballot.picks.push(state.next.left);
const vote=async(id,cookie,method='PUT')=>handleTierVotes({env,request:request('/api/tier-votes?kind=gems',id,method,method==='PUT'?{ballot}:undefined,cookie)});
const initial=await vote();
assert.equal(initial.status,200);
assert.match(initial.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Lax/);
const cookie=initial.headers.get('Set-Cookie').split(';')[0];
assert.equal((await vote(undefined,cookie)).status,200);
assert.equal((await (await vote(undefined,cookie,'GET')).json()).total,1);
let current=await accessSettings(DB);
async function configure(changes){
 const response=await handleAdmin({env,request:request('/api/admin','admin','POST',{action:'save-access',revision:current.revision,
  features:current.features.map(feature=>({...feature,...changes[feature.id]}))})});
 if(response.ok)current=await response.json();
 return response;
}
assert.equal((await handleAdmin({env,request:request('/api/admin?view=access','regular')})).status,403);
assert.equal((await configure({'gem-vote':{guest:false}})).status,200);
assert.equal((await vote(undefined,cookie)).status,401);
assert.equal((await vote('regular')).status,200);
assert.equal((await (await vote(undefined,cookie,'GET')).json()).canVote,false);
let access=await publicPolicy({env,request:request('/api/feature-access?path=/gem-tiers/')});
assert.equal((await access.json()).features.find(feature=>feature.id==='gem-vote').loginRequired,true);
assert.equal((await configure({'gem-vote':{loggedIn:false,guest:true},growth:{guest:false},research:{loggedIn:false,guest:false}})).status,200);
assert.equal((await vote('regular')).status,403);
assert.equal((await vote(undefined,cookie)).status,200);
const route=async(path,id)=>middleware({env,request:request(path,id),next:async()=>new Response('allowed')});
assert.equal((await route('/growth/')).status,401);
assert.equal((await route('/growth/index.html')).status,401);
assert.equal((await route('/growth/','regular')).status,200);
assert.equal((await route('/research/')).status,403);
assert.equal((await route('/research/','regular')).status,403);
assert.equal((await route('/research/','admin')).status,200);
assert.equal((await route('/account/')).status,200,'login entry stays accessible');
assert.equal((await route('/api/me/decks')).status,401);
assert.match((await route('/growth/','regular')).headers.get('Cache-Control'),/no-store/);
const stale={action:'save-access',revision:current.revision-1,features:current.features};
assert.equal((await handleAdmin({env,request:request('/api/admin','admin','POST',stale)})).status,409);
const before=JSON.stringify(await accessSettings(DB));
assert.equal((await configure({'saved-decks':{guest:true}})).status,400);
assert.equal(JSON.stringify(await accessSettings(DB)),before);
const body={action:'save-access',revision:current.revision,features:current.features};
assert.equal((await handleAdmin({env,request:request('/api/admin','admin','POST',body,undefined,false)})).status,403);
const competing=await Promise.all([
 handleAdmin({env,request:request('/api/admin','admin','POST',{...body,features:current.features.map(feature=>({...feature,...(feature.id==='gem-vote'?{guest:false}:{})}))})}),
 handleAdmin({env,request:request('/api/admin','admin','POST',{...body,features:current.features.map(feature=>({...feature,...(feature.id==='gem-vote'?{guest:true}:{})}))})})
]);
assert.deepEqual(competing.map(response=>response.status).sort(),[200,409]);
assert.equal((await accessSettings(DB)).features.find(feature=>feature.id==='gem-vote').guest,false,'stale writer never overwrites the winner');
console.log('Feature access: public guest votes, browser replacement, admin settings, role combinations, page/API guards, account-only features, CSRF and concurrent-save protection passed.');
