const assert=require('node:assert/strict');
(async()=>{
 const {tally,validateBallot,handleTierVotes,assignVoteTiers}=await import('./server/tier-votes.mjs');
 const {roster}=await import('./server/tier-roster.mjs');
 const ballot=roster.slice(0,7);
 assert.ok(validateBallot(ballot));
 assert.ok(!validateBallot([...ballot.slice(0,6),ballot[0]]));
 assert.ok(!validateBallot(ballot.slice(0,6)));
 assert.ok(!validateBallot([...ballot.slice(0,6),'invalid']));
 const rows=tally([ballot]);
 assert.deepEqual(rows.filter(r=>r.score).map(r=>r.score),[7,6,5,4,3,2,1]);
 assert.deepEqual(rows.filter(r=>r.score).map(r=>r.tier),['S','S','A','B','B','C','D']);
 assert.equal(rows.filter(r=>r.tier==='미득표').length,roster.length-7);
 assert.ok(tally([ballot,[...ballot].reverse()]).filter(r=>r.score).every(r=>r.score===8&&r.tier==='S'));
 assert.ok(tally([]).every(r=>r.tier==='미득표'));
 const classify=scores=>assignVoteTiers(scores.map((score,i)=>({slug:String(i).padStart(2,'0'),score})));
 const group=classify([100,96,75,72,55,40,30,20,10,5,0,0]);
 assert.deepEqual(group.map(r=>r.tier),['0','0','S','S','A','B','B','C','D','D','미득표','미득표']);
 assert.equal(classify([120,100,90,80,70])[0].tier,'0','exactly 20% promotes');
 assert.ok(!classify([119,100,90,80,70]).some(r=>r.tier==='0'),'below 20% does not promote');
 assert.ok(!classify([100,96,75,70,65,60,55,50,45]).some(r=>r.tier==='0'),'nine scored units permit only one candidate');
 assert.equal(classify([100,96,75,70,65,60,55,50,45,40]).filter(r=>r.tier==='0').length,2,'ten scored units permit two candidates');
 assert.ok(!classify([100,96,95,70,65,60,55,50,45,40,0,0,0,0,0]).some(r=>r.tier==='0'),'unvoted units do not expand the candidate group');
 assert.equal(classify([120,100,70,60,50,40,30,20,10,5]).filter(r=>r.tier==='0').length,2,'largest qualifying gap determines the group in one split');
 assert.equal(classify([150,120,80,76,65,60,50,40,30,20]).filter(r=>r.tier==='0').length,2,'a lower larger gap includes both leaders');
 assert.equal(classify([144,120,100,90,80,70,60,50,40,30]).filter(r=>r.tier==='0').length,1,'equal relative gaps prefer the earlier boundary');
 assert.equal(classify([180,120,100,90,80,70,60,50,40,30]).filter(r=>r.tier==='0').length,1,'the upper larger gap keeps only the top leader');
 assert.ok(!classify([100,50,25,10]).some(r=>r.tier==='0'),'fewer than five scored units cannot form a top fifth group');
 assert.ok(classify([100,100,100,100,100]).every(r=>r.tier==='S'),'ties stay together');
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
