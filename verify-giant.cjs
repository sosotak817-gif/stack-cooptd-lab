const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
require('./dist/engine.js');
const context={self:{location:{href:'http://localhost/'}},importScripts(){},URL,TextEncoder,crypto:require('node:crypto').webcrypto,COOP_DATA_REVISION:'test-giant',CoopOptimize:require('./ui/optimizer-core.js'),CoopGemTools:require('./ui/gem-tools.js'),CoopEngine,CoopData,CoopBoss,CoopTargets,CoopAccount,console};vm.createContext(context);vm.runInContext(fs.readFileSync('ui/board-worker.js','utf8'),context);
const summary=context.giantSummary,target={type:'GiantsBoss',eventSeconds:30,shield:100,hp:10,hpLayers:1,phaseLayers:[1,2,3]};
let run={target,kill:{phases:[10,15,Infinity],segments:[{phase:2,from:25,to:30,rate:10}]}};
let g=summary(run);assert.equal(g.cleared,2);assert.equal(g.phases[1].at,25);assert.ok(Math.abs(g.phases[2].progress-50/310)<1e-12);assert.equal(g.seconds,null);
g=summary({target,kill:{phases:[Infinity,NaN,NaN],segments:[]}});assert.equal(g.cleared,0);assert.equal(g.phases[1].reached,false);assert.equal(g.phases[2].progress,0);
g=summary({target,kill:{phases:[10,10,10],segments:[]}});assert.equal(g.cleared,3);assert.equal(g.seconds,30);
g=summary({target,kill:{phases:[10,10,10.01],segments:[]}});assert.equal(g.cleared,2,'completion after timer cannot clear');
assert.equal(summary({target:{type:'SpecialBoss'}}),null);
(async()=>{
 const P=require('./ui/board-presets.js'),p=P.newAccount(CoopEngine,CoopData),other=P.newAccount(CoopEngine,CoopData),t=CoopTargets.TARGETS.find(t=>t.mode==='hard'&&t.type==='GiantsBoss');p.perDemon.clara={level:21,lib:20,skinLevels:2,gems:[]};
 const input={cells:[{slug:'clara',row:6,col:3,lib:true,nolib:false}],marks:[],you:p,partner:other,partnerEnabled:false,mode:t.mode,target:t.id};
 const r=await context.calculate(input);assert.equal(r.giant.total,t.phaseLayers.length);assert.equal(r.giant.cleared,2);assert.ok(r.giant.phases[0].at<r.giant.phases[1].at);assert.equal(r.giant.phases[3].reached,false);assert.equal((await context.calculate(input)).cached,true);
 console.log('Giant phases: original hard-mode run, cumulative completion times, partial progress, timer boundary, failed/NaN phases and cache passed.',JSON.stringify(r.giant));
})().catch(e=>{console.error(e);process.exitCode=1});
