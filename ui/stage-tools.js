(function(root){'use strict';
const MODES={hard:'어려움',hell:'지옥',abyss:'심연',deepsea:'심해'};
function targets(T,mode){if(!MODES[mode])throw Error('지원하지 않는 모드입니다.');return T.TARGETS.filter(t=>t.mode===mode&&['Monster','LineBoss','SpecialBoss'].includes(t.type)).sort((a,b)=>a.wave-b.wave||a.id.localeCompare(b.id));}
function variant(input,mode,altar){const next=structuredClone(input);next.mode=mode;for(const side of ['you','partner'])if(altar==='none')next[side].altar={};return next;}
// Use the original target formula, including deep-sea and boss shred penalties.
function maxDefenceParams(params,T,mode){const next={...params},list=targets(T,mode);let minimum=100;while(list.some(t=>T.leftoverDef(t,minimum,0)>0)&&minimum<10000)minimum+=25;next.otherDef=Math.max(Number(next.otherDef)||0,minimum);return next;}
function integrate(kill,until){if(!kill)return 0;const end=Math.min(until,kill.leak?.at??Infinity,Number.isFinite(kill.seconds)?kill.seconds:Infinity);return Math.max(0,(kill.segments||[]).reduce((n,s)=>n+Math.max(0,Math.min(end,s.to)-Math.max(0,s.from))*Math.max(0,s.rate),0)-(kill.heals||[]).filter(h=>h.at<end).reduce((n,h)=>n+h.amount,0));}
function summarize(run,input,T,B,correction){
 const t=run.target,window=T.waveClock(t,t.wave),mob=t.type==='Monster',pool=T.fightPool(t),sides=input.partnerEnabled?['you','partner']:['you'];let lanes=[];
 if(mob){const count=T.waveSpawnCount(t.mode,t.wave)/2;for(const side of sides){const lane=run[side],rate=Math.max(0,lane?.dps||0)*correction.factor,required=pool*count,damage=Math.min(required,rate*window);lanes.push({side,required,damage,remaining:Math.max(0,required-damage),pass:rate*window+1e-6>=required,seconds:rate>0?required/rate:null});}}
 else if(run.lanes){for(const side of sides){const lane=run[side],spawn=run.lanes.lane(side).spawn,clock=Math.max(0,window-spawn),damage=integrate(lane.kill,clock),seconds=lane.kill.seconds;lanes.push({side,required:pool,damage:Math.min(pool,damage),remaining:Math.max(0,pool-damage),pass:Number.isFinite(seconds)&&seconds<=clock+1e-8&&!lane.kill.leak,seconds:Number.isFinite(seconds)?seconds+spawn:null,leak:!!lane.kill.leak});}}
 else {const damage=integrate(run.kill,window),seconds=run.kill.seconds;lanes.push({side:'shared',required:pool,damage:Math.min(pool,damage),remaining:Math.max(0,pool-damage),pass:Number.isFinite(seconds)&&seconds<=window+1e-8&&!run.kill.leak,seconds:Number.isFinite(seconds)?seconds:null,leak:!!run.kill.leak});}
 const pass=lanes.every(l=>l.pass),required=lanes.reduce((n,l)=>n+l.required,0),damage=lanes.reduce((n,l)=>n+l.damage,0),remaining=lanes.reduce((n,l)=>n+l.remaining,0),idle=(run.kill.segments||[]).filter(s=>s.idle&&s.idle!=='spawning').reduce((n,s)=>n+Math.max(0,Math.min(window,s.to)-s.from),0),shield=(run.kill.segments||[]).filter(s=>s.kind==='shield').reduce((n,s)=>n+Math.max(0,Math.min(window,s.to)-s.from),0);
 let cause=null,tips=[];if(!pass){if(mob){cause='일반 몬스터 처리량 부족';tips.push('광역 공격·공격 속도·공격 범위를 늘리고 일반 몬스터 구간의 배치를 확인하세요.');}else if(lanes.some(l=>l.leak)){cause='적 이탈';tips.push('동선에 닿는 위치로 이동하고 둔화·빙결·기절로 공격 시간을 확보하세요.');}else{cause='보스 제한시간 초과';tips.push('보스 구간의 단일 대상 딜과 스택 성장 시간을 보완하세요.');}if(idle>window*.15)tips.push('공격 공백이 큽니다. 사거리와 보스의 공격 중단 기믹을 확인하세요.');if(shield>window*.5)tips.push('보호막 처리에 시간이 많이 쓰입니다. 보호막 대상 피해 옵션을 비교하세요.');if(correction.defence<75)tips.push('공통 방감이 75% 미만입니다. 방감과 보석 도감 설정을 확인하세요.');}
 return{id:t.id,wave:t.wave,type:t.type,name:T.targetName(t),estimated:mob,pass,required,damage,remaining,window,seconds:lanes.every(l=>l.seconds!==null)?Math.max(...lanes.map(l=>l.seconds)):null,lanes,cause,tips,idle,shield,correction};
}
async function scan({input,modes,altar='current',evaluate,T,onProgress=()=>{}}){const results=[];for(const mode of modes){const base=variant(input,mode,altar),rows=[],list=targets(T,mode);for(const t of list){const row=await evaluate({...base,target:t.id},t);rows.push(row);onProgress({mode,done:rows.length,total:list.length,row});}const waves=[...new Set(rows.map(r=>r.wave))].map(wave=>{const variants=rows.filter(r=>r.wave===wave);return{wave,pass:variants.every(r=>r.pass),variants};}),first=waves.find(w=>!w.pass),causes={};for(const r of rows.filter(r=>!r.pass))causes[r.cause]=(causes[r.cause]||0)+1;results.push({mode,altar,waves,rows,firstRisk:first?.wave??null,passed:!first,causes:Object.entries(causes).map(([cause,count])=>({cause,count})).sort((a,b)=>b.count-a.count),coverage:list.length,lastWave:T.lastWave(mode)});}return results;}
// Diagnostic events observe original combat; they never alter damage or survival rules.
function recorder(T,G,cells){
 const rounds=new Map,units=cells.map(c=>({id:String(G.tileIndex(c.row,c.col)),slug:c.slug,row:c.row,col:c.col,side:G.sideOf(c.row)})),homes=new Map(units.map(u=>[Number(u.id),u]));let current=fresh();
 function fresh(){const damageByKind={mob:{you:0,partner:0},boss:{you:0,partner:0},other:{you:0,partner:0}};return{spawnPool:0,erasedPool:0,eaten:0,addedLayers:0,bossPool:0,youBossDamage:0,damageBySide:{you:0,partner:0},bossBySide:damageByKind.boss,damageByKind,unitDamage:{}};}
 return{rounds,units,event(e){
  if(e.kind==='spawn'){current.spawnPool+=e.pool||0;const t=T.TARGET_BY_ID.get(e.tid);if(t&&['LineBoss','SpecialBoss'].includes(t.type))current.bossPool+=e.pool||0;}
  if(e.kind==='gone'&&e.fate==='cleared')current.erasedPool+=e.pool||0;
  if(e.kind==='ate'){current.eaten+=e.eaten||0;current.addedLayers+=e.layers||0;}
  if(e.kind==='hit'){const t=T.TARGET_BY_ID.get(e.tid),home=Number(String(e.tower).split(':').at(-1)),unit=homes.get(home),damage=Number.isFinite(e.dealt)?Math.max(0,e.dealt):0;if(unit&&damage>0){const side=unit.side,kind=t&&['LineBoss','SpecialBoss','QuestBoss','GiantsBoss'].includes(t.type)?'boss':t&&['Monster','DeepSea_SpecialMonster','Giants'].includes(t.type)?'mob':'other',index=kind==='mob'?0:kind==='boss'?1:2,counts=current.unitDamage[unit.id]??=[0,0,0];counts[index]+=damage;current.damageBySide[side]+=damage;current.damageByKind[kind][side]+=damage;if(side==='you'&&t&&['LineBoss','SpecialBoss'].includes(t.type))current.youBossDamage+=damage;}}
  if(e.kind==='waveStacks'){rounds.set(e.wave,current);current=fresh();}
 }};
}
function continuousReport({run,mode,altar,T,rounds,basis,units=[]}){
 const lastWave=T.lastWave(mode),firstRisk=run.gameOver?.wave??null,causes={},rows=[];
 for(let wave=1;wave<=lastWave;wave++){
  const w=run.waves.find(w=>w.wave===wave),t=w?T.TARGET_BY_ID.get(w.target):T.waveTarget(mode,wave),e=rounds.get(wave),reached=!!w,failed=firstRisk===wave;
  const cause=failed?({lives:'누적 생명 소진',boss:'특수 보스 제한시간 초과',clock:'최종 전투 제한시간 초과'}[run.gameOver.why]||run.gameOver.why):null;
  if(cause)causes[cause]=(causes[cause]||0)+1;
  const required=reached?Math.max(0,(w.carryIn||0)+(e?.spawnPool||0)-(e?.erasedPool||0)):null,damage=reached?Object.values(w.sides).reduce((n,s)=>n+(s.dealt||0),0):null;
  const warning=reached&&!failed&&((w.leftover||0)>0||(w.leaks||0)>0);
  rows.push({id:t.id,wave,type:t.type,name:T.targetName(t),reached,pass:reached&&!failed,estimated:false,warning,required,damage,remaining:w?.leftover??null,window:w?.scheduled??T.waveSeconds(mode,wave),seconds:w?.killAt??null,cause,tips:failed?['사거리·배치·빙결과 누적 이탈, 저장된 소환·해방 시점을 확인하세요.']:[],lanes:[],damageBySide:e?.damageBySide??{you:0,partner:0},bossBySide:e?.bossBySide??{you:0,partner:0},damageByKind:e?.damageByKind??{mob:{you:0,partner:0},boss:{you:0,partner:0},other:{you:0,partner:0}},carryIn:w?.carryIn??null,lives:w?.lives??null,leaks:w?.leaks??null,eaten:e?.eaten||0,addedLayers:e?.addedLayers||0,tracked:w?.tracked??false});
 }
 const final=rows.at(-1),w=run.waves.find(w=>w.wave===lastWave),e=rounds.get(lastWave);
 // Capacity, not capped damage share: extrapolate the observed boss-only effective
 // mean rate to its allotted clock. One person = half the shared boss durability.
 const seconds=w?.killAt??w?.seconds,contribution=e?.bossPool>0&&seconds>0?{people:2*e.youBossDamage/seconds*final.window/e.bossPool,wave:lastWave,ownDamage:e.youBossDamage,seconds,window:final.window,requiredPerPerson:e.bossPool/2,estimated:true}:null;
 // Keep per-unit counters once per report, outside duplicated wave/row diagnostics.
 const unitDamageByWave=Object.fromEntries(rows.filter(r=>r.reached).map(r=>[r.wave,rounds.get(r.wave)?.unitDamage||{}]));
 return{mode,altar,basis,continuous:true,damageSchema:2,units,unitDamageByWave,rows,waves:rows.map(r=>({wave:r.wave,pass:r.pass,reached:r.reached,variants:[r]})),firstRisk,passed:!firstRisk&&!!w,causes:Object.entries(causes).map(([cause,count])=>({cause,count})),coverage:run.waves.length,lastWave,bossCapacity:contribution,lives:run.lives};
}
async function personEstimate({evaluate,baseline,onProgress=()=>{}}){
 let evaluated=0,low=0,high=1;const probes=[];
 async function test(scale){onProgress({evaluated,scale});const r=scale===1&&baseline?baseline:await evaluate(scale);evaluated++;probes.push({scale,passed:!!r.passed,firstRisk:r.firstRisk});return !!r.passed;}
 const baselinePassed=await test(1);
 if(baselinePassed){while(high>1e-6){const next=high/2;if(!await test(next)){low=next;break;}high=next;}if(!low)return{people:null,lowerBound:1/high,baselinePassed,evaluated,probes,bounded:false,estimated:true};}
 else {low=1;high=2;while(!await test(high)){low=high;high*=2;if(high>1e6)return{people:null,baselinePassed,evaluated,probes,bounded:false,estimated:true};}}
 // A passing and failing full-run replay bracket the local transition. Stop
 // when both ends agree at the displayed precision, without rounding scores.
 for(let n=0;n<24;n++){if((1/low).toFixed(1)===(1/high).toFixed(1))break;const mid=(low+high)/2;if(await test(mid))high=mid;else low=mid;}
 return{people:1/((low+high)/2),minimum:1/high,maximum:1/low,passingScale:high,failingScale:low,baselinePassed,evaluated,probes,bounded:true,estimated:true};
}
root.CoopStages={MODES,targets,variant,maxDefenceParams,integrate,summarize,scan,recorder,continuousReport,personEstimate};if(typeof module!=='undefined')module.exports=root.CoopStages;
})(globalThis);
