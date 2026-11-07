const assert=require('node:assert/strict'),W=require('./ui/worldcup-core.js');
require('./dist/engine.js');
function finish(items,preferred=[]){
 const ballot=W.create(items,()=>.75);
 let result;
 while(!(result=W.replay(ballot,items)).complete){
  const {left,right}=result.next,a=preferred.indexOf(left),b=preferred.indexOf(right);
  assert.ok(result.maxMatches>result.played,'pending comparison has remaining budget');
  ballot.picks.push(a>=0&&(b<0||a<b)?left:b>=0?right:left);
 }
 return ballot;
}
(async()=>{
 for(let count=2;count<=80;count++){
  const items=Array.from({length:count},(_,i)=>'item-'+i),ballot=finish(items),result=W.replay(ballot,items);
  assert.ok(result.played<=result.maxMatches);
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
 const {validateBallot,tally,assignVoteTiers,assignGemVoteTiers}=await import('./server/tier-votes.mjs');
 const legacy=items.slice(0,7);
 assert.ok(validateBallot(ballot,items));
 const counted=tally([legacy,ballot],items);
 assert.equal(counted.reduce((sum,row)=>sum+row.score,0),28+items.length*(items.length+1)/2);
 assert.ok(counted.every(row=>row.score>0));
 const soft=tally(Array(15).fill(ballot),items,'gems'),softCounts=Object.fromEntries(['0','S','A','B','C','D'].map(tier=>[tier,soft.filter(row=>row.tier===tier).length]));
 assert.deepEqual(softCounts,{'0':0,S:5,A:9,B:17,C:9,D:5},'gem tiers use the soft target distribution without forcing 0 Tear');
 const separated=Array.from({length:45},(_,index)=>{const average=index===0?45:index===1?44:36-(index-2)*.5;return{slug:'gem-'+index,score:average*20,votes:20,ranks:Array(7).fill(0)}});
 assignGemVoteTiers(separated);
 assert.deepEqual(separated.filter(row=>row.tier==='0').map(row=>row.slug),['gem-0','gem-1'],'the strongest relative top-three gap creates a small 0 Tear group');
 const provisional=structuredClone(separated);assignGemVoteTiers(provisional,14);
 assert.equal(provisional.some(row=>row.tier==='0'),false,'0 Tear waits for fifteen completed gem ballots');
 const tied=Array.from({length:10},(_,index)=>({slug:'tie-'+index,score:100,votes:20,ranks:Array(7).fill(0)}));
 assignGemVoteTiers(tied);
 assert.equal(new Set(tied.map(row=>row.tier)).size,1,'equal average scores are never split across gem tiers');
 const demonRows=[100,79,60,40,20,1].map((score,index)=>({slug:'demon-'+index,score,votes:1,ranks:Array(7).fill(0)}));
 assert.deepEqual(assignVoteTiers(demonRows).map(row=>row.tier),['0','S','A','B','C','D'],'the existing demon tier thresholds remain unchanged');
 assert.ok(validateBallot(ballot,[...items,'future-gem']),'historic snapshot survives a later roster addition');
 console.log('Worldcup: 2–80 entrants, complete rankings, gem soft tiers, optional 0 Tear, tie preservation and unchanged demon tiers passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
