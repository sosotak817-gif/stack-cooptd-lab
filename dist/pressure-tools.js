(function(root){'use strict';
const MAX_SEARCH_BUDGET=60,MAX_PURCHASES=100;
const TYPES=[{key:28,name:'종류당 공격력 +500%',price:5},{key:31,name:'기본 공격력 +50,000',price:3},{key:34,name:'치명타 피해 +200%',price:1},{key:36,name:'기본 공격력 +10%',price:1}];
function countsAtCost(cost,index=0,counts=[]){if(index===TYPES.length-1){const price=TYPES[index].price;return cost%price?[]:[[...counts,cost/price]]}const out=[];for(let n=0;n*TYPES[index].price<=cost;n++)out.push(...countsAtCost(cost-n*TYPES[index].price,index+1,[...counts,n]));return out}
function price(counts){return counts.reduce((sum,n,i)=>sum+n*TYPES[i].price,0)}
function candidate(base,level,counts){if(!Number.isInteger(level)||level<1||level>5||counts.length!==4||counts.some(n=>!Number.isInteger(n)||n<0||n>MAX_PURCHASES))throw Error('수압 단계/진주 개수를 확인하세요.');const next=structuredClone(base),sides=next.partnerEnabled?['you','partner']:['you'];for(const side of sides){next[side].pressureLv=level;next[side].dsPressure=[...(next[side].dsPressure||[]),...TYPES.flatMap((t,i)=>Array(counts[i]).fill(t.key))]}return next}
function withoutPressure(account){return{...account,pressureLv:1,dsPressure:[]};}
function* normalCombos(picks,count,start=0,keys=[]){if(!count){yield keys;return;}for(let i=start;i<picks.length;i++)yield*normalCombos(picks,count-1,i,[...keys,picks[i].key]);}
async function scenarioSearch({base,Account,evaluate,budget=3,maxLevel=5,onProgress=()=>{},maxEvaluations=1000,timeLimit=240000,now=()=>Date.now()}){if(!Number.isInteger(budget)||budget<0||budget>6||!Number.isInteger(maxLevel)||maxLevel<1||maxLevel>5)throw Error('시나리오 진주 탐색 범위를 확인하세요.');const picks=Account.PRESSURE_PICKS.filter(p=>!p.giant&&p.price===1),cases=[],started=now();let evaluated=0;for(let level=1;level<=maxLevel;level++){let entry=null,local=0,cutoff=false;outer:for(let cost=0;cost<=budget;cost++)for(const keys of normalCombos(picks,cost)){if(local>=Math.floor(maxEvaluations/maxLevel)||now()-started>=timeLimit){cutoff=true;break outer;}const input=structuredClone(base);for(const side of input.partnerEnabled?['you','partner']:['you']){input[side].pressureLv=level;input[side].dsPressure=[...(input[side].dsPressure||[]),...keys];}onProgress({level,cost,evaluated});const result=await evaluate(input);local++;evaluated++;if(result.pass){entry={level,cost,keys,verified:true,result};break outer;}}cases.push(entry||{level,cost:null,verified:false,cutoff});}return{cases,evaluated,budget,maxLevel,cutoff:cases.some(c=>c.cutoff),scope:'normal-pearls-fixed-pressure'};}
function goalOf(value,before){const total=before.giant.total;if(value==='all'||value==null)return total;if(value==='next')return Math.min(total,before.giant.cleared+1);const match=/^phase:(\d+)$/.exec(value),goal=match?Number(match[1]):NaN;if(!Number.isInteger(goal)||goal<1||goal>total)throw Error('목표 페이즈를 확인하세요.');return goal;}
function comparison(before,after,goal){const phase=(r)=>r.giant.phases.find(p=>p.phase===goal),b=phase(before),a=phase(after),delta=Number.isFinite(before.actual)&&Number.isFinite(after.actual)?after.actual-before.actual:null;return{beforeDps:before.actual??null,afterDps:after.actual??null,delta,percent:before.actual>0&&delta!==null?delta/before.actual*100:null,beforeRemaining:b?.remaining??null,afterRemaining:a?.remaining??null,beforeCleared:before.giant.cleared,afterCleared:after.giant.cleared};}
function progress(result,goal){const g=result.giant;return g.cleared+(g.phases[goal-1]?.progress||0)/10}
async function search({base,before,goal,minLevel=1,maxLevel=1,budget=4,evaluate,onProgress=()=>{},maxEvaluations=1225,timeLimit=240000,now=()=>Date.now()}){
 if(!Number.isInteger(budget)||budget<0||budget>MAX_SEARCH_BUDGET||!Number.isInteger(goal)||goal<1||goal>before.giant.total||!Number.isInteger(maxLevel)||maxLevel<1||maxLevel>5||!Number.isInteger(minLevel)||minLevel<1||minLevel>maxLevel)throw Error('탐색 범위를 확인하세요.');
 const started=now();let evaluated=0,best=null,cutoff=false;
 for(let cost=0;cost<=budget;cost++)for(let level=minLevel;level<=maxLevel;level++)for(const counts of countsAtCost(cost)){
  if(evaluated>=maxEvaluations||now()-started>=timeLimit){cutoff=true;return{found:false,verified:false,cutoff,best,evaluated,goal,budget,minLevel,maxLevel}}
  onProgress({evaluated,cost,level,counts});const input=candidate(base,level,counts),result=await evaluate(input);evaluated++;
  const entry={level,counts,cost,result,input};if(!best||progress(result,goal)>progress(best.result,goal))best=entry;
  if(result.giant.cleared>=goal)return{found:true,verified:true,cutoff:false,best:entry,evaluated,goal,budget,minLevel,maxLevel};
 }
 return{found:false,verified:false,cutoff,best,evaluated,goal,budget,minLevel,maxLevel};
}
root.CoopPressure={TYPES,countsAtCost,price,candidate,search,goalOf,comparison,withoutPressure,scenarioSearch,MAX_SEARCH_BUDGET,MAX_PURCHASES};if(typeof module!=='undefined')module.exports=root.CoopPressure;
})(globalThis);
