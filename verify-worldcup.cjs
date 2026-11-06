const assert=require('node:assert/strict'),W=require('./ui/worldcup-core.js');
require('./dist/engine.js');
function finish(items,preferred=[]){
 const ballot=W.create(items,()=>.75);
 let result;
 while(!(result=W.replay(ballot,items)).complete){
  const {left,right}=result.next,a=preferred.indexOf(left),b=preferred.indexOf(right);
  ballot.picks.push(a>=0&&(b<0||a<b)?left:b>=0?right:left);
 }
 return ballot;
}
(async()=>{
 for(let count=2;count<=80;count++){
  const items=Array.from({length:count},(_,i)=>'item-'+i),ballot=finish(items),result=W.replay(ballot,items);
  assert.equal(result.finalRanking.length,count);
  assert.equal(new Set(result.finalRanking).size,count);
  assert.equal(result.matches.filter(match=>!match.bye).length,ballot.picks.length);
  assert.equal(result.placements.reduce((sum,row)=>sum+row.points,0),count*(count+1)/2);
  assert.deepEqual(result.placements.map(row=>row.points),Array.from({length:count},(_,i)=>count-i));
  assert.equal(result.ranking[0],result.tournamentChampion);
  if(count>=4)assert.ok(result.matches.some(match=>match.phase==='placement'));
  const reversed=result.finalRanking.slice().reverse(),edited={...ballot,finalRanking:reversed};
  assert.equal(W.replay(edited,items).champion,reversed[0]);
  assert.throws(()=>W.replay({...edited,picks:edited.picks.slice(0,-1)},items));
  assert.throws(()=>W.replay({...ballot,picks:[...ballot.picks,'extra']},items));
  assert.throws(()=>W.replay({...edited,finalRanking:Array(count).fill(items[0])},items));
 }
 const items=CoopData.GEMS.map(g=>g.id),ballot=finish(items),partial={...ballot,picks:ballot.picks.slice(0,3)};
 assert.equal(W.replay(partial,items).complete,false);
 assert.throws(()=>W.replay({...ballot,picks:['not-a-candidate',...ballot.picks.slice(1)]},items));
 assert.throws(()=>W.replay({...ballot,seed:ballot.seed.map(value=>value===items[0]?items[1]:value)},items));
 const {validateBallot,tally}=await import('./server/tier-votes.mjs');
 const legacy=items.slice(0,7);
 assert.ok(validateBallot(ballot,items));
 const counted=tally([legacy,ballot],items);
 assert.equal(counted.reduce((sum,row)=>sum+row.score,0),28+items.length*(items.length+1)/2);
 assert.ok(counted.every(row=>row.score>0));
 assert.ok(validateBallot(ballot,[...items,'future-gem']),'historic snapshot survives a later roster addition');
 console.log('Worldcup: 2–80 entrants, byes, complete placement matches, all-rank scores, final order validation, malformed transcripts and legacy totals passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
