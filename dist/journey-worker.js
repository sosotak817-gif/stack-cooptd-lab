'use strict';
const journeyVersion=new URL(self.location.href).searchParams.get('v')||'';
importScripts('/board-worker.js'+(journeyVersion?'?v='+journeyVersion:''),'/journey-core.js'+(journeyVersion?'?v='+journeyVersion:''));
const originalHandler=self.onmessage;
function continuous(input){
 const basis=CoopPresets.hasPartnerDeck(input)?'partner':input.stageBasis||'mirror',party=CoopPresets.giantInput(input,basis),{cells,marks}=CoopGemTools.active(party),target=CoopTargets.finalBossOf(input.mode),targetId='journey-continuous:'+input.mode;
 CoopTargets.registerTargets([{...target,id:targetId,pinsWave:false}]);
 const p={...CoopEggby.normalize(party.you,CoopEngine),mode:input.mode,targetId,bounties:'none',wave:input.goalWave+1,byPlayer:true},other={...CoopEggby.normalize(party.partner,CoopEngine),mode:input.mode,targetId,bounties:'none',wave:p.wave};
 if(!party.partnerEnabled)Object.assign(other,{traits:[],codexSS:0,codexSSS:0,fortuneCard:0,altar:{},otherDef:0,partnerDef:0});if(basis==='solo'&&input.stageMaxDefence===true)Object.assign(p,CoopStages.maxDefenceParams(p,CoopTargets,input.mode));p.partnerParams=other;
 const trace=CoopStages.recorder(CoopTargets,CoopGeometry,cells),run=CoopBoss.bossRun(cells,p,{marks,range:{},blackout:'auto',builds:{you:p,partner:other},gold:false,bounties:null},undefined,event=>trace.event(event));
 return CoopJourney.diagnosisSummary(CoopStages.continuousReport({run,mode:input.mode,altar:'current',T:CoopTargets,rounds:trace.rounds,basis}),input.goalWave);
}
async function budget(input,id){
 const request=input.budgetRequest,budget=Number(request?.budget),given=request?.entries;if(!Number.isInteger(budget)||budget<1||budget>999999999||!Array.isArray(given)||!given.length||given.length>40)throw Error('예산과 비용 후보를 확인하세요.');
 const baseline=await calculate(input),candidates=CoopJourney.candidates(input,CoopEngine,CoopData,{replacement:null,stacks:false,milestones:true}),available=new Map(candidates.map(candidate=>[CoopJourney.changeKey(candidate),candidate])),used=new Set,entries=[];
 for(const item of given){if(typeof item?.key!=='string'||used.has(item.key)||!available.has(item.key))throw Error('현재 덱과 맞지 않는 비용 후보가 있습니다. 성장 비교를 다시 실행하세요.');const candidate=available.get(item.key),cost=Number(item.cost),estimate=Number(item.estimate);if(!CoopJourney.budgetGroup(candidate)||!Number.isInteger(cost)||cost<1||cost>999999999||!Number.isFinite(estimate)||estimate<=0)throw Error('비용 후보 값을 확인하세요.');used.add(item.key);const {state,...row}=candidate;entries.push({row,cost,estimate});}
 const shortlist=CoopJourney.budgetPlans(entries,budget);if(!shortlist.length)throw Error('입력한 예산 안에 적용할 수 있는 성장 후보가 없습니다.');const evaluated=[];postMessage({id,kind:'budget-progress',done:0,total:shortlist.length});
 for(const [index,plan]of shortlist.entries()){await schedulerTurn();await new Promise(resolve=>setTimeout(resolve,0));const state=CoopJourney.applyGoals(input,plan.entries.map(entry=>entry.row),CoopData),result=await calculate(state),actual=result.actual,delta=actual-baseline.actual;evaluated.push({budget,cost:plan.cost,estimatedDelta:plan.score,actual,delta,gain:baseline.actual>0?delta/baseline.actual*100:null,rows:plan.entries.map(entry=>({...entry.row,cost:entry.cost,independentDelta:entry.estimate}))});postMessage({id,kind:'budget-progress',done:index+1,total:shortlist.length});}
 evaluated.sort((a,b)=>b.delta-a.delta||a.cost-b.cost||b.estimatedDelta-a.estimatedDelta);postMessage({id,kind:'budget-result',baseline,plans:evaluated.filter(plan=>plan.delta>Math.max(1e-9,baseline.actual*1e-9)).slice(0,3),evaluated:evaluated.length,entered:entries.length,budget});
}
self.onmessage=async({data})=>{
 if(data.kind==='__scheduler')return originalHandler({data});
 const {id,kind}=data;
 try{
  CoopJourney.validateDeck(data,CoopData,CoopGeometry,CoopTargets);
  if(!CoopJourney.MODES[data.mode])throw Error('어려움~심해 난이도를 선택하세요.');
  if(kind==='budget'){await budget(data,id);return;}
  if(kind==='diagnosis'&&(!Number.isInteger(data.goalWave)||data.goalWave<1||data.goalWave>CoopTargets.lastWave(data.mode)))throw Error('목표 라운드를 확인하세요.');
  const baseline=kind==='diagnosis'?continuous(data):await calculate(data),options=CoopJourney.candidates(data,CoopEngine,CoopData,{replacement:data.replacement,stacks:kind!=='diagnosis',milestones:kind!=='diagnosis'}),rows=[];
  postMessage({id,kind:'journey-progress',done:0,total:options.length,baseline});
  for(const [i,candidate]of options.entries()){
   await schedulerTurn();await new Promise(resolve=>setTimeout(resolve,0));
   const {state,...meta}=candidate;
   if(kind==='diagnosis'){const result=continuous(state);rows.push({...meta,result});}
   else {const result=await calculate(state);rows.push({...meta,actual:result.actual,comparison:CoopJourney.comparisonEvidence(data,baseline,result,meta.slug)});}
   postMessage({id,kind:'journey-progress',done:i+1,total:options.length});
  }
  const sorted=kind==='diagnosis'?rows.sort((a,b)=>Number(b.result.passed)-Number(a.result.passed)||(b.result.firstRisk??data.goalWave+1)-(a.result.firstRisk??data.goalWave+1)||(a.result.shortfall??Infinity)-(b.result.shortfall??Infinity)):CoopJourney.rank(rows,baseline.actual);
  postMessage({id,kind:'journey-result',baseline,rows:sorted,input:data});
 }catch(error){postMessage({id,error:error.message});}
};
