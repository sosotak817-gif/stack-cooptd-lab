(function(root){
 'use strict';
 const FORMAT='worldcup-v1';
 const points=(rank,count)=>count-rank+1;
 const roundName=round=>round===2?'결승':round===4?'준결승':round+'강';
 const placeName=rank=>rank===1?'1위 · 우승':rank===2?'2위 · 준우승':rank+'위';

 function create(items,random=Math.random){
  const shuffled=items.slice();
  for(let i=shuffled.length-1;i>0;i--){
   const j=Math.floor(random()*(i+1));
   [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
  }
  const size=2**Math.ceil(Math.log2(items.length)),byes=size-items.length,seed=[];
  let at=0;
  for(let pair=0;pair<size/2;pair++){
   seed.push(shuffled[at++],pair<byes?null:shuffled[at++]);
  }
  return {format:FORMAT,seed,picks:[]};
 }

 function replay(ballot,items){
  const invalid=()=>{throw Error('월드컵 대진 또는 선택 기록을 확인하세요.');};
  if(!ballot||ballot.format!==FORMAT||!Array.isArray(ballot.seed)||!Array.isArray(ballot.picks)||items.length<2)invalid();
  const size=2**Math.ceil(Math.log2(items.length)),seed=ballot.seed;
  const limit=items.length-1+items.length*Math.ceil(Math.log2(items.length));
  if(seed.length!==size||ballot.picks.length>limit)invalid();
  const actual=seed.filter(value=>value!==null),allowed=new Set(items);
  if(actual.length!==items.length||new Set(actual).size!==items.length||actual.some(value=>!allowed.has(value)))invalid();
  for(let i=0;i<seed.length;i+=2)if(seed[i]===null&&seed[i+1]===null)invalid();
  const matches=[],groups=new Map(),ranking=[];
  let round=seed.slice(),chosen=0,nextMatch=null;
  function choose(left,right,meta){
   if(chosen===ballot.picks.length){nextMatch={left,right,...meta};return null;}
   const winner=ballot.picks[chosen++];
   if(winner!==left&&winner!==right)invalid();
   matches.push({left,right,winner,bye:false,...meta});
   return winner;
  }
  function pending(){
   if(ballot.finalRanking!==undefined)invalid();
   return {complete:false,next:nextMatch,matches,played:chosen,mainMatches:items.length-1,rankedCount:ranking.length,totalCount:items.length};
  }
  while(round.length>1){
   const next=[],losers=[],total=round.reduce((sum,value,i)=>sum+(i%2===0&&value!==null&&round[i+1]!==null?1:0),0);
   let match=0;
   for(let i=0;i<round.length;i+=2){
    const left=round[i],right=round[i+1];
    if(left===null||right===null){
     const winner=left??right;
     next.push(winner);
     matches.push({phase:'tournament',round:round.length,left,right,winner,bye:true});
     continue;
    }
    const winner=choose(left,right,{phase:'tournament',round:round.length,match:++match,total});
    if(winner===null)return pending();
    losers.push(winner===left?right:left);
    next.push(winner);
   }
   groups.set(round.length,losers);
   round=next;
  }
  const tournamentChampion=round[0];
  ranking.push(tournamentChampion);
  function sortGroup(contenders,range){
   if(contenders.length<=1)return contenders;
   const middle=Math.floor(contenders.length/2);
   const left=sortGroup(contenders.slice(0,middle),range);
   if(left===null)return null;
   const right=sortGroup(contenders.slice(middle),range);
   if(right===null)return null;
   const sorted=[];
   let a=0,b=0;
   while(a<left.length&&b<right.length){
    const winner=choose(left[a],right[b],{phase:'placement',from:range.from,to:range.to});
    if(winner===null)return null;
    sorted.push(winner);
    if(winner===left[a])a++;else b++;
   }
   return sorted.concat(left.slice(a),right.slice(b));
  }
  for(const [,contenders]of [...groups].sort((a,b)=>a[0]-b[0])){
   const sorted=sortGroup(contenders,{from:ranking.length+1,to:ranking.length+contenders.length});
   if(sorted===null)return pending();
   ranking.push(...sorted);
  }
  if(chosen!==ballot.picks.length)invalid();
  const finalRanking=ballot.finalRanking===undefined?ranking:ballot.finalRanking;
  if(!Array.isArray(finalRanking)||finalRanking.length!==items.length||new Set(finalRanking).size!==items.length||finalRanking.some(slug=>!allowed.has(slug)))invalid();
  const placements=finalRanking.map((slug,index)=>({slug,place:index+1,points:points(index+1,items.length)}));
  return {complete:true,champion:finalRanking[0],tournamentChampion,ranking,finalRanking:finalRanking.slice(),matches,placements,
   played:chosen,mainMatches:items.length-1,rankedCount:items.length,totalCount:items.length};
 }

 const api={FORMAT,create,replay,points,roundName,placeName};
 root.CoopWorldcup=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
