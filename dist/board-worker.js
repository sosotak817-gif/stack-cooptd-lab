const assetVersion=new URL(self.location?.href||'http://localhost/').searchParams.get('v');importScripts(...['/cache-version.js','/engine.js','/optimizer-core.js','/gem-tools.js','/board-presets.js','/pressure-tools.js'].map(path=>path+(assetVersion?'?v='+assetVersion:'')));
const memory=new Map();let dbPromise;
function database(){return dbPromise??=new Promise(resolve=>{if(!self.indexedDB){resolve(null);return}const req=indexedDB.open('stack-lab-dps-cache',1);req.onupgradeneeded=()=>req.result.createObjectStore('results',{keyPath:'key'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);req.onblocked=()=>resolve(null)})}
async function cacheKey(input){const bytes=new TextEncoder().encode(CoopOptimize.cacheInput(input,COOP_DATA_REVISION));const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('')}
async function read(key){if(memory.has(key))return memory.get(key);const db=await database();if(!db)return;return new Promise(resolve=>{try{const req=db.transaction('results').objectStore('results').get(key);req.onsuccess=()=>resolve(req.result?.result);req.onerror=()=>resolve()}catch{resolve()}})}
async function write(key,result){memory.set(key,result);if(memory.size>300)memory.delete(memory.keys().next().value);const db=await database();if(!db)return;await new Promise(resolve=>{try{const tx=db.transaction('results','readwrite'),store=tx.objectStore('results');store.put({key,result,created:Date.now()});const req=store.count();req.onsuccess=()=>{let extra=req.result-1500;if(extra>0){const cursor=store.openCursor();cursor.onsuccess=()=>{const item=cursor.result;if(item&&extra-->0){item.delete();item.continue()}}}};tx.oncomplete=tx.onerror=tx.onabort=()=>resolve()}catch{resolve()}})}
// Integrate the original time-varying combat segments, never the displayed mean DPS.
// Segments already account for attack/hit-driven ramps, reach, disable and phases.
function expectedDamage(run,factor=1){
 const clock=CoopTargets.runClock(run.target);
 const sum=(kill,until)=>{
  const end=Math.max(0,Math.min(until,kill.leak?.at??Infinity,Number.isFinite(kill.seconds)?kill.seconds:Infinity));
  return kill.segments.reduce((total,segment)=>total+Math.max(0,Math.min(end,segment.to)-Math.max(0,segment.from))*Math.max(0,segment.rate),0);
 };
 return Object.fromEntries([10,30,60].map(seconds=>{
  const dealt=run.lanes?['you','partner'].reduce((total,side)=>{
   const spawn=run.lanes.lane(side).spawn;
   return total+sum(run[side].kill,Math.min(seconds,clock)-spawn);
  },0):sum(run.kill,Math.min(seconds,clock));
  return [seconds,dealt*factor];
 }));
}
// Phase durations include each spawn transition. A failed phase is Infinity;
// subsequent NaN/Infinity phases must never be counted as cleared.
function giantSummary(run){
 if(run.target.type!=='GiantsBoss')return null;
 const limit=CoopTargets.runClock(run.target),pools=CoopTargets.phasePools(run.target),lengths=run.kill.phases||[],phases=[];
 let start=0,cleared=0;
 for(let i=0;i<pools.length;i++){
  const duration=lengths[i],end=start+duration,complete=Number.isFinite(end)&&end<=limit+1e-8;
  const visited=Number.isFinite(start)&&start<limit;
  const damage=run.kill.segments.filter(s=>s.phase===i).reduce((sum,s)=>sum+Math.max(0,Math.min(limit,s.to)-Math.max(0,s.from))*Math.max(0,s.rate),0);
  const healed=(run.kill.heals||[]).filter(h=>h.at>=start&&h.at<Math.min(limit,end)).reduce((sum,h)=>sum+h.amount,0);
  const required=pools[i],dealt=visited?Math.max(0,damage):0,recovered=visited?Math.max(0,healed):0;
  const effectiveDamage=complete?required:Math.max(0,Math.min(required,dealt-recovered)),remaining=complete?0:Math.max(0,required-effectiveDamage);
  phases.push({phase:i+1,cleared:complete,at:complete?end:null,reached:visited,required,damage:dealt,healed:recovered,effectiveDamage,remaining,progress:complete?1:visited&&required>0?effectiveDamage/required:0});
  if(complete)cleared++;
  start=complete?end:Infinity;
 }
 return{cleared,total:pools.length,limit,seconds:cleared===pools.length?start:null,phases};
}
async function calculate(input){const key=await cacheKey(input),saved=await read(key);if(saved)return{...saved,cached:true};const {you,partner,mode,target}=input,{cells,marks}=CoopGemTools.active(input),p={...you,mode,targetId:target},other={...partner,mode,targetId:target};if(!input.partnerEnabled){Object.assign(other,{traits:[],codexSS:0,codexSSS:0,fortuneCard:0,altar:{},otherDef:0,partnerDef:0})}const t=CoopTargets.TARGET_BY_ID.get(target);if(!t)throw Error('계산 대상을 찾을 수 없습니다.');p.wave=t.wave;other.wave=t.wave;const r=CoopBoss.computeBossBoard(cells,p,{marks,range:{},blackout:'auto',builds:{you:p,partner:other},gold:false,bounties:null});const actual=CoopBoss.runActual(r);if(!Number.isFinite(actual)||actual<0||!Number.isFinite(r.dps))throw Error('유효한 DPS를 계산할 수 없습니다.');const correction=CoopGemTools.penalty(CoopAccount.spawnShredOf(p).total+(input.partnerEnabled?CoopAccount.spawnShredOf(other).total:0));const result={actual:actual*correction.factor,theory:r.dps*correction.factor,rawActual:actual,rawTheory:r.dps,correction,damage:expectedDamage(r,correction.factor),giant:giantSummary(r),seconds:Number.isFinite(r.kill.seconds)?r.kill.seconds:null,window:r.kill.event?.window,units:r.units.map(u=>({slug:u.placement.slug,row:u.placement.row,col:u.placement.col,liberated:u.liberated,dps:u.dps*correction.factor,range:u.range,cover:u.cover,stats:u.result?{level:u.result.stats.level,levelBase:u.result.stats.levelBase,levelBonus:u.result.stats.levelBonus,lib:u.result.stats.lib,baseAtk:u.result.stats.baseAtk,effAtk:u.result.stats.effAtk}:null}))};await write(key,result);return{...result,cached:false}}
self.onmessage=async({data})=>{const{id,kind='calculate'}=data;try{if(kind==='pressure'){
 if(data.mode!=='deepsea')throw Error('심해 모드에서 사용할 수 있습니다.');
 const target=CoopTargets.TARGETS.find(t=>t.mode==='deepsea'&&t.type==='GiantsBoss'),party={...CoopPresets.giantInput(data,data.giantBasis),target:target.id};
 postMessage({id,kind:'pressure-progress',message:'적용 전 거인 세팅 계산 중…'});const before=await calculate(party),goal=data.pressureGoal==='next'?Math.min(before.giant.total,before.giant.cleared+1):before.giant.total;
 if(data.pressureAction==='compare'){const afterInput=CoopPressure.candidate(party,data.pressureLevel,data.pressureCounts),after=await calculate(afterInput);postMessage({id,kind:'pressure-result',before,goal,basis:party.giantBasis,found:after.giant.cleared>=goal,verified:false,manual:true,evaluated:1,best:{input:afterInput,result:after,counts:data.pressureCounts,level:data.pressureLevel,cost:CoopPressure.price(data.pressureCounts)}});return}
 const scan=await CoopPressure.search({base:party,before,goal,maxLevel:data.pressureLevel,budget:data.pressureBudget,evaluate:calculate,onProgress:p=>postMessage({id,kind:'pressure-progress',...p})});postMessage({id,kind:'pressure-result',before,basis:party.giantBasis,...scan});return
 }if(kind==='giant'){const target=CoopTargets.TARGETS.find(t=>t.mode===data.mode&&t.type==='GiantsBoss');if(!target)throw Error('이 맵에는 거대 거인 데이터가 없습니다.');if(!CoopGemTools.active(data).cells.length)throw Error('초마신을 먼저 배치해 주세요.');const party=CoopPresets.giantInput(data,data.giantBasis);const r=await calculate({...party,target:target.id});postMessage({id,kind,giant:{...r.giant,basis:party.giantBasis},cached:r.cached});return}if(kind==='recommend'){const side=data.recommendSide||'you',cells=CoopGemTools.active(data).cells,slugs=[...new Set(cells.filter(c=>CoopGemTools.sideOf(c)===side).map(c=>c.slug))];const base=await calculate(data),groups=slugs.map(slug=>({slug,copies:cells.filter(c=>CoopGemTools.sideOf(c)===side&&c.slug===slug).length,lib:CoopEngine.effectiveLib(data[side],slug)})).sort((a,b)=>base.units.filter(u=>u.slug===b.slug).reduce((s,u)=>s+u.dps,0)-base.units.filter(u=>u.slug===a.slug).reduce((s,u)=>s+u.dps,0));const r=await CoopGemTools.recommend({groups,build:data[side].perDemon,inventory:data.inventory||[],gemById:CoopData.GEM_BY_ID,evaluate:build=>calculate({...data,[side]:{...data[side],perDemon:build}}),onProgress:progress=>postMessage({id,kind:'gem-progress',...progress})});postMessage({id,kind:'recommended',side,...r});return}if(kind==='optimize'){const tiles=Object.fromEntries(['you','partner'].map(s=>[s,CoopGeometry.tilesOf(s).map(({row,col})=>({row,col}))]));const r=await CoopOptimize.optimize({cells:data.cells,marks:data.marks||[],tiles,evaluate:(cells,marks)=>calculate({...data,cells,marks}),maxEvaluations:data.depth==='deep'?600:160,timeLimit:data.depth==='deep'?40000:12000,onProgress:progress=>postMessage({kind:'progress',id,...progress})});postMessage({kind:'optimized',id,...r})}else postMessage({id,...await calculate(data)})}catch(e){postMessage({id,kind,error:e.message})}};
