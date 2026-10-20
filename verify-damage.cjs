const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {load}=require('./inspect.cjs'),E=load(98018),D=load(34621),B=load(49460),T=load(1503),P=require('./ui/board-presets.js');
const context={self:{location:{href:'http://localhost/'}},importScripts(){},URL,TextEncoder,crypto:require('node:crypto').webcrypto,COOP_DATA_REVISION:'test-damage-v1',CoopOptimize:require('./ui/optimizer-core.js'),CoopGemTools:require('./ui/gem-tools.js'),CoopEngine:E,CoopData:D,CoopBoss:B,CoopTargets:T,CoopAccount:load(42389),console};
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
(async()=>{
 const t=T.TARGETS.find(x=>x.mode==='deepsea'&&x.type==='SpecialBoss'&&x.wave===100);
 for(const slug of ['ivy','clara']){
  const p=P.newAccount(E,D);p.perDemon[slug]={level:21,lib:20,skinLevels:2,gems:[]};p.mode=t.mode;p.targetId=t.id;p.wave=t.wave;
  const other=P.newAccount(E,D),cells=[{slug,row:6,col:3,lib:true,nolib:false}];
  const r=B.computeBossBoard(cells,p,{marks:[],range:{},blackout:'auto',builds:{you:p,partner:other},gold:false,bounties:null});
  const values=integrate(r),ramps=[...r.ramps.values()].flat();
  assert.ok(ramps.some(x=>x.drive=== (slug==='ivy'?'attacks':'hits')),slug+' uses original attack/hit ramp');
  assert.ok(values[10]>0&&values[30]>values[10]&&values[60]>values[30]);
  assert.ok(Math.abs(values[60]/values[10]-6)>.1,slug+' cumulative damage is not average DPS times duration');
  const input={cells,marks:[],you:p,partner:other,partnerEnabled:false,mode:t.mode,target:t.id};
  const calculated=await context.calculate(input);
  assert.equal(calculated.damage[30],values[30]*calculated.correction.factor);
  const cached=await context.calculate(input);assert.equal(cached.cached,true);assert.equal(cached.damage[60],calculated.damage[60]);
  console.log(slug,JSON.stringify(calculated.damage));
 }
 console.log('Time damage: original Ivy/Clara ramps, integration, clipping, death/leak, partner spawn, defence correction and cache passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
