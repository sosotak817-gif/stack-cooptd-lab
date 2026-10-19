const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{load,ctx}=require('./inspect.cjs');
const source=load(98018),db=load(34621),sandbox={window:{},console,URL,URLSearchParams,TextEncoder,TextDecoder,performance,setTimeout,clearTimeout,Buffer};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('dist/engine.js','utf8'),sandbox);const generated=sandbox.CoopEngine;
let count=0;for(const demon of db.DEMONS){for(const variant of [0,100]){const p=structuredClone(source.DEFAULT_PARAMS);p.otherAtk=variant;const a=source.computeDemon(demon,p),b=generated.computeDemon(demon,structuredClone(p));assert.ok(Number.isFinite(a.dps)&&a.dps>=0,demon.slug+' DPS');assert.equal(b.dps,a.dps,demon.slug+' generated engine parity');count++}}
for(const tier of ['supreme','demon-god','other']){const rows=generated.computeAll(structuredClone(source.DEFAULT_PARAMS),tier);assert.ok(rows.length>0);assert.ok(rows.every((x,i)=>!i||rows[i-1].dps>=x.dps))}
const boss=load(49460),targets=load(1503);let boards=0;const originalObj=x=>vm.runInContext('JSON.parse',ctx)(JSON.stringify(x)),generatedObj=x=>vm.runInContext('JSON.parse',sandbox)(JSON.stringify(x));
for(const mode of ['normal','hard','hell','abyss','deepsea'])for(const cells of [[{slug:'oni',row:6,col:1,lib:true}],[{slug:'oni',row:10,col:0,lib:true}],[{slug:'oni',row:6,col:1,lib:true},{slug:'witch-doctor',row:6,col:2,lib:true},{slug:'ancient-blue-dragon',row:6,col:4,lib:true}]]){const p=structuredClone(source.DEFAULT_PARAMS);p.mode=mode;p.targetId=targets.finalBossOf(mode).id;const field={range:{},blackout:'auto',gold:false,bounties:null},a=boss.computeBossBoard(originalObj(cells),originalObj(p),originalObj(field)),b=sandbox.CoopBoss.computeBossBoard(generatedObj(cells),generatedObj(p),generatedObj(field));assert.equal(b.dps,a.dps);assert.equal(sandbox.CoopBoss.runActual(b),boss.runActual(a));assert.ok(Number.isFinite(sandbox.CoopBoss.runActual(b)));boards++}
assert.equal(sandbox.CoopBoard.flameStage(1),1);assert.equal(sandbox.CoopBoard.flameStage(10),1);assert.equal(sandbox.CoopBoard.flameStage(11),2);assert.equal(sandbox.CoopBoard.flameStage(19),2);assert.equal(sandbox.CoopBoard.flameStage(20),3);
{
 const p=structuredClone(source.DEFAULT_PARAMS);p.mode='deepsea';p.targetId=targets.finalBossOf(p.mode).id;p.lib=20;
 const cells=[{slug:'oni',row:6,col:1,lib:true},{slug:'witch-doctor',row:6,col:2,lib:true},{slug:'latest-helicopter-machine',row:6,col:4,lib:true}];
 const run=marks=>sandbox.CoopBoss.computeBossBoard(generatedObj(cells),generatedObj(p),generatedObj({marks,range:{},blackout:'auto',gold:false,bounties:null}));
 const base=run([]),heli=run([{row:6,col:1,boost:true}]),witch=run([{row:6,col:1,storms:1}]);
 assert.ok(heli.units[0].result.stats.critDmg>base.units[0].result.stats.critDmg,'helicopter tile adds critical damage');
 assert.ok(witch.units[0].result.stats.finalMult>base.units[0].result.stats.finalMult,'witch storm adds final damage');
 for(const marks of [[{row:6,col:1,boost:true}],[{row:6,col:1,storms:1}],[{row:6,col:1,boost:true,storms:1}]]){
  const original=boss.computeBossBoard(originalObj(cells),originalObj(p),originalObj({marks,range:{},blackout:'auto',gold:false,bounties:null})),built=run(marks);
  assert.equal(built.dps,original.dps);assert.equal(sandbox.CoopBoss.runActual(built),boss.runActual(original));
 }
 console.log('장판 효과 검증: 헬리 치명타 피해 / 부두술사 최종 피해 / 원본 DPS 일치');
}
const records=JSON.parse(fs.readFileSync('collection.json','utf8')),failures=records.filter(x=>typeof x.bytes!=='number');console.log(JSON.stringify({unitParityCases:count,boardParityCases:boards,tiers:3,collected:records.length,unavailable:failures},null,2));
