(function(root){'use strict';
const TYPES=[{key:28,name:'종류당 공격력 +500%',price:5},{key:31,name:'기본 공격력 +50,000',price:3},{key:34,name:'치명타 피해 +200%',price:1},{key:36,name:'기본 공격력 +10%',price:1}];
function countsAtCost(cost,index=0,counts=[]){if(index===TYPES.length-1){const price=TYPES[index].price;return cost%price?[]:[[...counts,cost/price]]}const out=[];for(let n=0;n*TYPES[index].price<=cost;n++)out.push(...countsAtCost(cost-n*TYPES[index].price,index+1,[...counts,n]));return out}
function price(counts){return counts.reduce((sum,n,i)=>sum+n*TYPES[i].price,0)}
function candidate(base,level,counts){if(!Number.isInteger(level)||level<1||level>5||counts.length!==4||counts.some(n=>!Number.isInteger(n)||n<0||n>12))throw Error('수압 단계/진주 개수를 확인하세요.');const next=structuredClone(base),sides=next.partnerEnabled?['you','partner']:['you'];for(const side of sides){next[side].pressureLv=level;next[side].dsPressure=[...(next[side].dsPressure||[]),...TYPES.flatMap((t,i)=>Array(counts[i]).fill(t.key))]}return next}
function progress(result,goal){const g=result.giant;return g.cleared+(g.phases[goal-1]?.progress||0)/10}
async function search({base,before,goal,maxLevel=1,budget=4,evaluate,onProgress=()=>{},maxEvaluations=1225,timeLimit=240000,now=()=>Date.now()}){
 if(!Number.isInteger(budget)||budget<0||budget>12||!Number.isInteger(goal)||goal<1||goal>before.giant.total||!Number.isInteger(maxLevel)||maxLevel<1||maxLevel>5)throw Error('탐색 범위를 확인하세요.');
 const started=now();let evaluated=0,best=null,cutoff=false;
 for(let cost=0;cost<=budget;cost++)for(const counts of countsAtCost(cost))for(let level=maxLevel;level>=1;level--){
  if(evaluated>=maxEvaluations||now()-started>=timeLimit){cutoff=true;return{found:false,verified:false,cutoff,best,evaluated,goal,budget,maxLevel}}
  onProgress({evaluated,cost,level,counts});const input=candidate(base,level,counts),result=await evaluate(input);evaluated++;
  const entry={level,counts,cost,result,input};if(!best||progress(result,goal)>progress(best.result,goal))best=entry;
  if(result.giant.cleared>=goal)return{found:true,verified:true,cutoff:false,best:entry,evaluated,goal,budget,maxLevel};
 }
 return{found:false,verified:false,cutoff,best,evaluated,goal,budget,maxLevel};
}
root.CoopPressure={TYPES,countsAtCost,price,candidate,search};if(typeof module!=='undefined')module.exports=root.CoopPressure;
})(globalThis);
