const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {load}=require('./inspect.cjs'),E=load(98018),D=load(34621),B=load(49460),T=load(1503),P=require('./ui/board-presets.js');
const context={self:{location:{href:'http://localhost/'}},importScripts(){},URL,TextEncoder,crypto:require('node:crypto').webcrypto,COOP_DATA_REVISION:'test-damage-v1',CoopOptimize:require('./ui/optimizer-core.js'),CoopGemTools:require('./ui/gem-tools.js'),CoopEggby:require('./ui/eggby-tools.js'),CoopEngine:E,CoopData:D,CoopBoss:B,CoopTargets:T,CoopAccount:load(42389),console};
vm.createContext(context);vm.runInContext(fs.readFileSync('ui/board-worker.js','utf8'),context);
const integrate=context.expectedDamage;
const target={eventSeconds:60,eventCount:1};
// Partial segment clipping, dead time, gross damage (heals don't erase attacks), death cap.
const kill={seconds:25,segments:[{from:0,to:2,rate:0},{from:2,to:20,rate:10},{from:20,to:25,rate:20}],heals:[{at:12,amount:50}]};
assert.equal(integrate({target,kill})[10],80);assert.equal(integrate({target,kill})[30],280);assert.equal(integrate({target,kill})[60],280);
assert.equal(integrate({target,kill},.95)[30],266);
assert.equal(integrate({target,kill:{...kill,leak:{at:15}}})[60],130);
const lanes={lane:side=>({spawn:side==='you'?0:5})};
assert.equal(integrate({target,lanes,you:{kill},partner:{kill}})[10],110,'partner clock starts at its own spawn');
const range=context.dpsRange;
const ranged=range({target,kill});
assert.equal(ranged.min,0);assert.equal(ranged.max,20);assert.equal(ranged.maxAt,20);assert.equal(ranged.seconds,25);
const phaseKill={seconds:40,segments:[{from:0,to:3,rate:0,idle:'spawning'},{from:3,to:10,rate:10},{from:10,to:12,rate:0,idle:'dark'},{from:12,to:20,rate:30},{from:20,to:40,rate:0,kind:'dead'}]};
assert.equal(range({target,kill:phaseKill}).min,0,'combat disable counts');
assert.equal(range({target,kill:phaseKill}).seconds,17,'spawn and dead intervals excluded');
assert.equal(range({target,kill:{...phaseKill,leak:{at:11}}}).max,10,'leak clips later buffs');
assert.equal(range({target,kill:phaseKill},.75).max,22.5);
const first={seconds:10,segments:[{from:0,to:5,rate:10},{from:5,to:10,rate:100}]},second={seconds:10,segments:[{from:0,to:5,rate:100},{from:5,to:10,rate:10}]};
const aligned=range({target,lanes:{lane:()=>({spawn:0})},you:{kill:first},partner:{kill:second}});
assert.equal(aligned.min,110);assert.equal(aligned.max,110,'sum simultaneous rates, not individual extrema');
const shifted=range({target,lanes,you:{kill:first},partner:{kill:second}});
assert.equal(shifted.min,10);assert.equal(shifted.max,200);assert.equal(shifted.maxAt,5);
assert.equal(range({target,kill:{seconds:0,segments:[]}}).intervals,0);
(async()=>{
 const t=T.TARGETS.find(x=>x.mode==='deepsea'&&x.type==='SpecialBoss'&&x.wave===100);
 for(const slug of ['ivy','clara']){
  const p=P.newAccount(E,D);p.pressureLv=1;p.dsPressure=[];p.perDemon[slug]={level:21,lib:20,skinLevels:2,gems:[]};p.mode=t.mode;p.targetId=t.id;p.wave=t.wave;
  const other=P.newAccount(E,D),cells=[{slug,row:6,col:3,lib:true,nolib:false}];
  other.pressureLv=1;other.dsPressure=[];const r=B.computeBossBoard(cells,p,{marks:[],range:{},blackout:'auto',builds:{you:p,partner:other},gold:false,bounties:null});
  const values=integrate(r),ramps=[...r.ramps.values()].flat();
  assert.ok(ramps.some(x=>x.drive=== (slug==='ivy'?'attacks':'hits')),slug+' uses original attack/hit ramp');
  assert.ok(values[10]>0&&values[30]>values[10]&&values[60]>values[30]);
  assert.ok(Math.abs(values[60]/values[10]-6)>.1,slug+' cumulative damage is not average DPS times duration');
  const input={cells,marks:[],you:p,partner:other,partnerEnabled:false,mode:t.mode,target:t.id};
  const calculated=await context.calculate(input);
  assert.equal(calculated.damage[30],values[30]*calculated.correction.factor);
  const rawRange=range(r);assert.ok(rawRange.max>rawRange.min,slug+' temporal stack range');
  assert.equal(calculated.range.min,rawRange.min*calculated.correction.factor);assert.equal(calculated.range.max,rawRange.max*calculated.correction.factor);
  const cached=await context.calculate(input);assert.equal(cached.cached,true);assert.equal(cached.damage[60],calculated.damage[60]);
  assert.equal(cached.range.max,calculated.range.max);
  console.log(slug,JSON.stringify(calculated.damage));
 }
 console.log('Time damage: original Ivy/Clara ramps, integration, clipping, death/leak, partner spawn, defence correction and cache passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
