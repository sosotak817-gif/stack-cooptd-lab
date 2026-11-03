import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {handleDeckGuides} from './server/deck-guides.mjs';
const require=createRequire(import.meta.url);require('./dist/engine.js');require('./ui/board-presets.js');
const sqlite=new DatabaseSync(':memory:');
class Statement{constructor(sql,values=[]){this.sql=sql;this.values=values;}bind(...values){return new Statement(this.sql,values);}execute(){const query=sqlite.prepare(this.sql),results=query.columns().length?query.all(...this.values):(query.run(...this.values),[]);return{results,meta:{changes:sqlite.prepare('SELECT changes() AS count').get().count}};}async run(){return this.execute();}async all(){return this.execute();}async first(){return this.execute().results[0]??null;}}
const DB={prepare:sql=>new Statement(sql),async batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>s.execute());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
let clock=Date.now();const oldNow=Date.now;Date.now=()=>clock;const alice='a'.repeat(64),bob='b'.repeat(64);
const deck={version:2,unitDefaultsVersion:1,mode:'hard',target:CoopTargets.finalBossOf('hard').id,partnerEnabled:false,cells:[{row:6,col:3,slug:'clara',lib:true,nolib:false}],marks:[],you:CoopPresets.newAccount(CoopEngine,CoopData),partner:CoopPresets.newAccount(CoopEngine,CoopData),privateToken:'never publish'};deck.you.privateAccount='never publish';deck.you.perDemon.clara.privateNote='never publish';
const guide={format:'stack-lab-guide',version:1,title:'클라라 초반 공략',mode:'hard',wave:90,operation:'1. 소환\n2. 보스 집중',requirements:'해방 조건 확인',alternatives:'대체는 다시 계산',deck};
async function call(method='GET',data,{token=alice,query={},headers={},raw,noDB=false}={}){const response=await handleDeckGuides({env:noDB?{}:{DB},request:new Request('https://lab.example/api/deck-guides?'+new URLSearchParams(query),{method,headers:{Origin:'https://lab.example','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...headers},...(method!=='GET'?{body:raw??JSON.stringify(data)}:{})})});return{status:response.status,data:await response.json()};}
try{
 sqlite.exec(fs.readFileSync('migrations/0002_accounts.sql','utf8'));
 for(const [id,token] of [['account-a',alice],['account-b',bob]]){
  const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
  sqlite.prepare('INSERT INTO lab_users VALUES(?,?,?,?)').run(id,id,id,clock);
  sqlite.prepare('INSERT INTO lab_sessions VALUES(?,?,?,?)').run(hash,id,id,clock+86400000);
 }
 const accountHeaders=(id,token)=>({'X-Account-Id':id,'X-CSRF-Token':id,Cookie:'__Host-stack_session='+token});
 const a=accountHeaders('account-a',alice),b=accountHeaders('account-b',bob);
 const posted=await call('POST',{nickname:'spoofed',guide},{headers:a});
 assert.equal(posted.status,201);
 assert.equal(posted.data.post.nickname,'account-a');
 const edit={id:posted.data.post.id,expectedUpdatedAt:posted.data.post.updatedAt,guide};
 assert.equal((await call('PUT',edit,{headers:b})).status,403);
 assert.equal((await call('DELETE',edit,{headers:b})).status,403);
 assert.equal((await call('PUT',edit,{headers:{...a,'X-CSRF-Token':'bad'}})).status,403);
 const accountEdit=await call('PUT',edit,{headers:a,token:null});
 assert.equal(accountEdit.status,200);
 assert.equal((await call('DELETE',{...edit,expectedUpdatedAt:accountEdit.data.post.updatedAt},{headers:a,token:null})).status,200);

 assert.equal((await call('GET',null,{noDB:true})).status,503);
 assert.equal((await call()).data.total,0,'schema is initialized on first use without a deployment migration step');
 for(const query of [{page:'0'},{page:'-1'},{page:'1.5'},{mode:'toString'},{mode:'bad'},{q:'x'.repeat(81)}])assert.equal((await call('GET',null,{query})).status,400);
 assert.equal((await call('GET',null,{token:null,query:{mine:1}})).status,401);
 assert.equal((await call('POST',{nickname:'작성자',guide},{token:null})).status,401);
 assert.equal((await call('POST',{nickname:'작성자',guide},{headers:{Origin:'https://evil.example'}})).status,403);
 assert.equal((await call('POST',null,{raw:'x'.repeat(262145)})).status,413);
 assert.equal((await call('POST',null,{raw:'{"__proto__":{}}'})).status,400);
 for(const data of [null,[],{nickname:'',guide},{nickname:'가'.repeat(21),guide},{nickname:'bad\nname',guide},{nickname:'테스트',guide:{...guide,wave:100}},{nickname:'테스트',guide:{...guide,deck:{...deck,cells:[...deck.cells,...deck.cells]}}}])assert.equal((await call('POST',data)).status,400);
 const first=await call('POST',{nickname:'연구원 A',guide});assert.equal(first.status,201);let post=first.data.post;assert.equal(post.mine,true);assert.equal(post.guide.deck.privateToken,undefined);assert.equal(post.guide.deck.you.privateAccount,undefined);assert.equal(post.guide.deck.you.perDemon.clara.privateNote,undefined);assert.ok(!JSON.stringify(post).includes('owner'));
 const other=await call('GET',null,{token:bob,query:{id:post.id}});assert.equal(other.status,200);assert.equal(other.data.post.mine,false);assert.equal(other.data.post.guide.operation,guide.operation);assert.equal((await call('GET',null,{token:null,query:{id:post.id}})).status,200);
 assert.equal((await call('POST',{nickname:'A',guide})).status,429);
 for(const method of ['PUT','DELETE'])assert.equal((await call(method,{id:post.id,expectedUpdatedAt:post.updatedAt,nickname:'B',guide},{token:bob})).status,403);
 const update={id:post.id,expectedUpdatedAt:post.updatedAt,nickname:'연구원 A',guide:{...guide,title:'수정된 공략 🧪 <script>'}};const edited=await call('PUT',update);assert.equal(edited.status,200);assert.ok(edited.data.post.updatedAt>post.updatedAt);assert.equal((await call('PUT',update)).status,409);assert.equal((await call('DELETE',{id:post.id,expectedUpdatedAt:post.updatedAt})).status,409);post=edited.data.post;
 for(let i=0;i<13;i++){clock+=31000;const entry=await call('POST',{nickname:'연구원 '+i,guide:{...guide,title:'공략 '+i,mode:i%2?'hell':'hard'}},{token:(i+1).toString(16).padStart(64,'0')});assert.equal(entry.status,201);}
 const listing=await call('GET',null,{token:bob});assert.equal(listing.data.posts.length,12);assert.equal(listing.data.total,14);assert.equal(listing.data.posts[0].title,'공략 12');assert.equal(listing.data.posts[0].guide,undefined,'list payloads contain summaries, not all saved decks');assert.equal((await call('GET',null,{query:{page:2}})).data.posts.length,2);
 assert.equal((await call('GET',null,{query:{mode:'hell'}})).data.total,6);assert.equal((await call('GET',null,{query:{q:'연구원 A'}})).data.total,1);assert.equal((await call('GET',null,{query:{q:'소환'}})).data.total,14);assert.equal((await call('GET',null,{query:{q:"' OR 1=1 --"}})).data.total,0);assert.equal((await call('GET',null,{query:{q:'%'}})).data.total,0);assert.equal((await call('GET',null,{query:{mine:1}})).data.total,1);
 const removed=await call('DELETE',{id:post.id,expectedUpdatedAt:post.updatedAt});assert.equal(removed.status,200);assert.equal((await call('GET',null,{query:{id:post.id}})).status,404);assert.equal((await call('GET',null,{query:{mine:1}})).data.total,0);assert.equal(deck.privateToken,'never publish','publication never mutates the local save');
 // Migration and runtime initialization are compatible and preserve existing posts.
 sqlite.exec(fs.readFileSync('migrations/0006_deck_guides.sql','utf8'));assert.equal(sqlite.prepare('SELECT COUNT(*) AS total FROM deck_guides').get().total,13);
 console.log('Public deck guides: real SQLite schema/migration, cross-browser reads, author ownership, immutable sanitized gameplay snapshots, CRUD, edit conflicts, cooldown, bounded payloads, search/filter/pagination and missing DB passed.');
}finally{Date.now=oldNow;sqlite.close();}
