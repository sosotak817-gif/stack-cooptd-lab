import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { handleRankings } from './server/rankings.mjs';
import { catalog } from './server/ranking-catalog.mjs';

// Exercise the API against SQLite, including real upserts, RETURNING and pruning SQL.
const sqlite=new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync('migrations/0001_rankings.sql','utf8'));
class Statement {
 constructor(sql,values=[]){this.sql=sql;this.values=values;}
 bind(...values){return new Statement(this.sql,values);}
 execute(){
  const prepared=sqlite.prepare(this.sql),rows=prepared.columns().length?prepared.all(...this.values):(prepared.run(...this.values),[]);
  return {results:rows,meta:{changes:sqlite.prepare('SELECT changes() AS count').get().count}};
 }
 async first(){return this.execute().results[0]??null;}
}
const DB={prepare:sql=>new Statement(sql),async batch(statements){
 sqlite.exec('BEGIN');try{const result=statements.map(s=>s.execute());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}
}};
const target=catalog.targets[0].id, otherTarget=catalog.targets.find(t=>t.id!==target).id;
let clock=Date.now(),sequence=0;
const oldNow=Date.now;Date.now=()=>clock;
const makeData=(changes={})=>({revision:catalog.revision,deck:'clara',target,nickname:'테스트',score:12,...changes});
async function call(method='GET',data,options={}){
 const token=options.token||(++sequence).toString(16).padStart(64,'0');
 const headers={Origin:'https://lab.example','Content-Type':'application/json',Authorization:'Bearer '+token,...options.headers};
 const response=await handleRankings({env:options.noDB?{}:{DB},request:new Request('https://lab.example/api/rankings'+(method==='GET'?'?'+new URLSearchParams({deck:'clara',target,...options.query}):''),{method,headers,...(method==='POST'?{body:options.raw??JSON.stringify(data)}:{})})});
 return {status:response.status,data:await response.json(),token};
}
try {
 assert.equal((await call('GET',null,{noDB:true})).status,503);
 assert.equal((await call('GET',null,{query:{page:'21'}})).status,400);
 assert.equal((await call('GET',null,{query:{page:'0'}})).status,400);
 assert.equal((await call('GET',null,{query:{deck:'custom'}})).status,400);
 assert.equal((await call('POST',makeData(),{headers:{Origin:'https://evil.example'}})).status,403);
 assert.equal((await call('POST',makeData(),{headers:{Authorization:'Bearer guessed'}})).status,401);
 for(const invalid of [null,[],makeData({score:'100'}),makeData({score:0}),makeData({score:-1}),makeData({score:1e101}),makeData({nickname:'<script>'}),makeData({revision:'old'}),makeData({target:'unknown'})]) assert.ok((await call('POST',invalid)).status>=400);
 assert.equal((await call('POST',null,{raw:'{'})).status,400);
 assert.equal((await call('POST',null,{raw:' '.repeat(2049)})).status,413);
 const first=await call('POST',makeData());assert.equal(first.status,201);assert.equal(first.data.improved,true);
 clock+=11000;
 const lower=await call('POST',makeData({score:1}),{token:first.token});assert.equal(lower.data.score,12);assert.equal(lower.data.improved,false);
 clock+=11000;
 assert.equal((await call('POST',makeData({score:20}),{token:first.token})).data.score,20);
 const records=await call('GET',null,{token:first.token});assert.equal(records.data.total,1);assert.equal(records.data.entries[0].mine,true);assert.ok(!('owner' in records.data.entries[0]));
 assert.equal((await call('GET')).data.entries[0].mine,false);
 assert.equal((await call('POST',makeData({deck:'goblin'}))).status,201);
 assert.equal((await call('POST',makeData({target:otherTarget}))).status,201);
 assert.equal((await call('GET')).data.total,1,'other decks and bosses must be separate');
 const ipOptions={headers:{'CF-Connecting-IP':'192.0.2.1'}};
 assert.equal((await call('POST',makeData(),ipOptions)).status,201);
 assert.equal((await call('POST',makeData(),ipOptions)).status,429,'new identities do not bypass IP cooldown');
 // Exactly 1,000 rows, including stable ordering for ties.
 sqlite.exec('DELETE FROM rankings');
 const insert=sqlite.prepare('INSERT INTO rankings VALUES (?,?,?,?,?,?,?)');
 sqlite.exec('BEGIN');for(let i=0;i<1000;i++)insert.run(catalog.revision,'clara',target,'seed'+i,'사용자'+i,1000-i,100);sqlite.exec('COMMIT');
 let submitted=await call('POST',makeData({score:.5}));assert.equal(submitted.data.retained,false);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM rankings').get().n,1000);
 submitted=await call('POST',makeData({score:2000}));assert.equal(submitted.data.retained,true);
 let top=await call('GET');assert.equal(top.data.entries[0].score,2000);assert.equal(top.data.total,1000);
 let last=await call('GET',null,{query:{page:'20'}});assert.equal(last.data.entries.length,50);assert.equal(last.data.entries.at(-1).rank,1000);
 await call('POST',makeData({score:2000}));top=await call('GET');assert.equal(top.data.entries[0].achievedAt,top.data.entries[1].achievedAt);
 // Same timestamp and score must still have deterministic pagination (owner tie-breaker).
 const again=await call('GET');assert.deepEqual(top.data.entries,again.data.entries);
 // Old engine revisions are never mixed into the current leaderboard.
 insert.run('old','clara',target,'old','이전 계산',1e10,1);
 assert.equal((await call('GET')).data.entries[0].score,2000);
 console.log('Rankings: real SQLite API validation, ownership, highest-only updates, categories, cooldown, deterministic ties, 1,000 cap, pagination and revision separation passed.');
} finally {Date.now=oldNow;sqlite.close();}
