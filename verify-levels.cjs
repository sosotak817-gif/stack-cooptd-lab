const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {load,ctx}=require('./inspect.cjs'),E=load(98018),D=load(34621),B=load(49460),T=load(1503),X=load(86245),P=require('./ui/board-presets.js');
require('./dist/engine.js');
let cases=0;
for(const slug of ['oni','cannon','clara','ivy'])for(const level of [1,10,12,13,15,16,21])for(const lib of [0,3,10,20]){
 const p=P.newAccount(E,D);p.eggbyAttached=false;p.perDemon[slug]={level,lib,skinLevels:0,gems:[]};
 const a=E.computeDemon(D.DEMON_BY_SLUG.get(slug),p),b=CoopEngine.computeDemon(CoopData.DEMON_BY_SLUG.get(slug),structuredClone(p));
 assert.equal(b.dps,a.dps);assert.equal(b.stats.baseAtk,a.stats.baseAtk);assert.equal(a.stats.level,level);
 assert.equal(a.stats.lib,Math.min(lib,X.maxLibAt(level)),'liberation is capped by base level');cases++;
}
const target=T.finalBossOf('hard');
const context=ctx;Object.assign(context,{self:{location:{href:'http://localhost/'}},importScripts(){},URL,TextEncoder,crypto:require('node:crypto').webcrypto,COOP_DATA_REVISION:'test-level-v1',CoopOptimize:require('./ui/optimizer-core.js'),CoopGemTools:require('./ui/gem-tools.js'),CoopEngine:E,CoopData:D,CoopBoss:B,CoopTargets:T,CoopAccount:load(42389),console});
vm.runInContext(fs.readFileSync('ui/board-worker.js','utf8'),context);
const original=x=>vm.runInContext('JSON.parse',ctx)(JSON.stringify(x));
(async()=>{
 const rows=[];
 for(const [level,lib,skinLevels,nolib] of [[1,0,0,false],[10,0,0,false],[21,0,0,false],[21,10,0,false],[21,20,0,false],[21,20,2,false],[21,20,2,true]]){
  const p=P.newAccount(E,D),partner=P.newAccount(E,D);p.perDemon.oni={level,lib,skinLevels,gems:[]};
  const input={mode:'hard',target:target.id,you:p,partner,partnerEnabled:false,cells:[{slug:'oni',row:6,col:1,lib:!nolib,nolib}],marks:[]};
  const result=await context.calculate(original(input));assert.equal(result.cached,false,'each level/lib/skin/placement has its own cache key');
  const configured={...p,mode:'hard',targetId:target.id,wave:target.wave},other={...partner,mode:'hard',targetId:target.id,wave:target.wave,traits:[],codexSS:0,codexSSS:0,fortuneCard:0,altar:{},otherDef:0,partnerDef:0};
  const raw=B.computeBossBoard(original(input.cells),original(configured),original({marks:[],range:{},blackout:'auto',builds:{you:configured,partner:other},gold:false,bounties:null}));
  assert.equal(result.rawActual,B.runActual(raw));assert.equal(result.units[0].stats.baseAtk,raw.units[0].result.stats.baseAtk);
  assert.equal(result.units[0].stats.level,level+skinLevels);assert.equal(result.units[0].stats.lib,nolib?-1:Math.min(lib,X.maxLibAt(level)));
  assert.equal((await context.calculate(original(input))).cached,true);
  rows.push({level,lib,skinLevels,nolib,attack:result.units[0].stats.baseAtk,dps:Math.round(result.actual)});
 }
 for(let i=1;i<6;i++){assert.ok(rows[i].attack>rows[i-1].attack,'level, liberation and skin each increase attack');assert.notEqual(rows[i].dps,rows[i-1].dps)}
 assert.ok(rows[6].attack<rows[5].attack,'unliberated copy does not receive liberation attack');
 console.log('Level/liberation: '+cases+' original parity cases; board DPS, skin bonus, unliberated copies and cache separation passed.');console.table(rows);
})().catch(e=>{console.error(e);process.exitCode=1});
