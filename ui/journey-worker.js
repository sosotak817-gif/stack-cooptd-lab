'use strict';
const journeyVersion=new URL(self.location.href).searchParams.get('v')||'';
importScripts('/board-worker.js'+(journeyVersion?'?v='+journeyVersion:''),'/journey-core.js'+(journeyVersion?'?v='+journeyVersion:''));
const originalHandler=self.onmessage;
function continuous(input){
 const basis=CoopPresets.hasPartnerDeck(input)?'partner':input.stageBasis||'mirror',party=CoopPresets.giantInput(input,basis),{cells,marks}=CoopGemTools.active(party),target=CoopTargets.finalBossOf(input.mode),targetId='journey-continuous:'+input.mode;
 CoopTargets.registerTargets([{...target,id:targetId,pinsWave:false}]);
 const p={...CoopEggby.normalize(party.you,CoopEngine),mode:input.mode,targetId,bounties:'none',wave:input.goalWave+1,byPlayer:true},other={...CoopEggby.normalize(party.partner,CoopEngine),mode:input.mode,targetId,bounties:'none',wave:p.wave};
 if(!party.partnerEnabled)Object.assign(other,{traits:[],codexSS:0,codexSSS:0,fortuneCard:0,altar:{},otherDef:0,partnerDef:0});p.partnerParams=other;
 const trace=CoopStages.recorder(CoopTargets,CoopGeometry,cells),run=CoopBoss.bossRun(cells,p,{marks,range:{},blackout:'auto',builds:{you:p,partner:other},gold:false,bounties:null},undefined,event=>trace.event(event));
 return CoopJourney.diagnosisSummary(CoopStages.continuousReport({run,mode:input.mode,altar:'current',T:CoopTargets,rounds:trace.rounds,basis}),input.goalWave);
}
self.onmessage=async({data})=>{
 if(data.kind==='__scheduler')return originalHandler({data});
 const {id,kind}=data;
 try{
  CoopJourney.validateDeck(data,CoopData,CoopGeometry,CoopTargets);
  if(!CoopJourney.MODES[data.mode])throw Error('어려움~심해 난이도를 선택하세요.');
  if(kind==='diagnosis'&&(!Number.isInteger(data.goalWave)||data.goalWave<1||data.goalWave>CoopTargets.lastWave(data.mode)))throw Error('목표 라운드를 확인하세요.');
  const baseline=kind==='diagnosis'?continuous(data):await calculate(data),options=CoopJourney.candidates(data,CoopEngine,CoopData,{replacement:data.replacement,stacks:kind!=='diagnosis'}),rows=[];
  postMessage({id,kind:'journey-progress',done:0,total:options.length,baseline});
  for(const [i,candidate]of options.entries()){
   await schedulerTurn();await new Promise(resolve=>setTimeout(resolve,0));
   const {state,...meta}=candidate;
   if(kind==='diagnosis'){const result=continuous(state);rows.push({...meta,result});}
   else {const result=await calculate(state);rows.push({...meta,actual:result.actual});}
   postMessage({id,kind:'journey-progress',done:i+1,total:options.length});
  }
  const sorted=kind==='diagnosis'?rows.sort((a,b)=>Number(b.result.passed)-Number(a.result.passed)||(b.result.firstRisk??data.goalWave+1)-(a.result.firstRisk??data.goalWave+1)||(a.result.shortfall??Infinity)-(b.result.shortfall??Infinity)):CoopJourney.rank(rows,baseline.actual);
  postMessage({id,kind:'journey-result',baseline,rows:sorted});
 }catch(error){postMessage({id,error:error.message});}
};
