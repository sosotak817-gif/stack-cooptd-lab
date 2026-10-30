const assert=require('node:assert/strict');
(async()=>{
 const {tally,validateBallot,handleTierVotes}=await import('./server/tier-votes.mjs');
 const {roster}=await import('./server/tier-roster.mjs');
 const ballot=roster.slice(0,7);
 assert.ok(validateBallot(ballot));
 assert.ok(!validateBallot([...ballot.slice(0,6),ballot[0]]));
 assert.ok(!validateBallot(ballot.slice(0,6)));
 assert.ok(!validateBallot([...ballot.slice(0,6),'invalid']));
 const rows=tally([ballot]);
 assert.deepEqual(rows.filter(r=>r.score).map(r=>r.score),[7,6,5,4,3,2,1]);
 assert.deepEqual(rows.filter(r=>r.score).map(r=>r.tier),['0','S','S','A','B','C','D']);
 assert.equal(rows.filter(r=>r.tier==='미득표').length,roster.length-7);
 assert.ok(tally([ballot,[...ballot].reverse()]).filter(r=>r.score).every(r=>r.score===8&&r.tier==='S'));
 assert.ok(tally([]).every(r=>r.tier==='미득표'));
 const exact=tally([ballot,[4,3,2,0,1,5,6].map(i=>ballot[i])]);assert.equal(exact[0].score,11);assert.equal(exact[1].score,10);assert.equal(exact[0].tier,'0');assert.equal(exact[1].tier,'S');assert.equal(exact.filter(r=>r.tier==='0').length,1);
 const below=tally([ballot,[3,2,0,1,4,5,6].map(i=>ballot[i])]);assert.equal(below[0].score,12);assert.equal(below[1].score,11);assert.ok(!below.some(r=>r.tier==='0'));
 const saved=new Map();
 const DB={prepare(sql){
  let args;
  return {
   bind(...a){args=a;return this;},
   async run(){if(sql.startsWith('INSERT'))saved.set(args[0],args[1]);return {};},
   async all(){return {results:[...saved].map(([voter,ballot])=>({voter,ballot}))};}
  };
 }};
 let cookie='';
 const call=async(method,ranking,origin='https://test.example')=>{
  const request=new Request('https://test.example/api/tier-votes',{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},...(method==='PUT'?{body:JSON.stringify({ranking})}:{})});
  const response=await handleTierVotes({env:{DB},request});
  if(response.headers.get('Set-Cookie'))cookie=response.headers.get('Set-Cookie').split(';')[0];
  return {status:response.status,data:await response.json()};
 };
 assert.equal((await call('GET')).data.total,0);
 let result=await call('PUT',ballot);assert.equal(result.status,200);assert.equal(result.data.total,1);assert.deepEqual(result.data.mine,ballot);
 result=await call('PUT',[...ballot].reverse());assert.equal(result.data.total,1);assert.equal(result.data.rows[0].slug,ballot[6]);
 assert.equal((await call('PUT',ballot,'https://evil.example')).status,403);
 assert.equal((await call('PUT',[ballot[0]])).status,400);
 assert.equal((await call('GET')).data.total,1);
 assert.equal((await handleTierVotes({request:new Request('https://test.example'),env:{}})).status,503);
 console.log('Tier voting: weighted scores, ties, validation, browser identity, vote replacement and errors passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
