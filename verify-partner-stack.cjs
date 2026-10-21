const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c={console,URL,TextEncoder,TextDecoder,performance,setTimeout,clearTimeout};
c.self=c;c.location={href:'http://localhost/board-worker.js'};vm.createContext(c);
c.structuredClone=x=>vm.runInContext('JSON.parse',c)(JSON.stringify(x));
c.importScripts=(...paths)=>paths.forEach(p=>vm.runInContext(fs.readFileSync('dist'+p.split('?')[0],'utf8'),c));
vm.runInContext(fs.readFileSync('ui/board-worker.js','utf8'),c);
// Original wave spawns are paired in SIDES order: you, then partner. There
// are deliberately no partner towers; enemy presence must not depend on them.
vm.runInContext(`var records=[];for(var slug of ['omen','clara','ivy']){
 var p=CoopPresets.newAccount(CoopEngine,CoopData);p.mode='hell';p.targetId=CoopTargets.finalBossOf('hell').id;
 p.perDemon[slug]={level:21,lib:20,relicLevel:8,gems:[]};
 var events=[];var run=CoopBoss.bossRun([{slug,row:6,col:3,lib:true}],p,{marks:[],builds:{you:p,partner:p}},undefined,e=>events.push(e));
 var nextWave=events.findIndex((e,i)=>i>0&&e.kind==='spawn'&&e.enemy===0);
 records.push({slug,events:nextWave<0?events:events.slice(0,nextWave),held:run.banks.held[45]});
}`,c);
for(const {slug,events,held} of c.records){
 const spawns=new Map(events.filter(e=>e.kind==='spawn').map(e=>[e.enemy,e]));
 const lanes=[new Set(),new Set()];
 for(const [id,e] of spawns)if(id%2===1){const own=spawns.get(id-1);if(own&&e.frame===own.frame&&e.tid===own.tid){lanes[0].add(id-1);lanes[1].add(id);}}
 assert.ok(lanes[1].size>0,'paired ordinary-wave enemies spawn on both lanes');
 for(const ids of lanes){
  assert.ok(events.some(e=>e.kind==='shot'&&ids.has(e.enemy)),`${slug} attacks both lanes without partner units`);
  assert.ok(events.some(e=>e.kind==='hit'&&ids.has(e.enemy)&&e.dealt>0),`${slug} damages both lanes`);
 }
 if(slug==='omen')assert.ok(held.souls>0);
}
const {load}=require('./inspect.cjs'),geometry=load(36053),attacks=load(4918);
const tower={side:'you',at:{x:0,y:0}},enemy={side:'partner',alive:true,hidden:false,half:{hx:.1,hy:.1},at:{x:.5,y:.5}};
const reaches=(t,e)=>Math.abs(t.at.x-e.at.x)<=1&&Math.abs(t.at.y-e.at.y)<=1;
const targeting=attacks.attacker({holds:()=>true,lock:t=>t.lock,fresh:t=>geometry.nearest([enemy],t,0,0,false,reaches),reaches,setLock:(t,e)=>t.lock=e});
for(const state of [{clara:{h:123}},{ivy:{s:123}}]){
 Object.assign(state,tower,{lock:enemy});assert.equal(targeting.pickAtStart(state),enemy);
 assert.equal((state.clara||state.ivy)[state.clara?'h':'s'],123,'reachable partner enemy does not trigger a no-target stack reset');
}
assert.equal(geometry.diesInside(enemy,tower,1),true,'partner death inside Omen zone is eligible');
assert.equal(geometry.diesInside({...enemy,at:{x:10,y:10}},tower,1),false,'other lane does not grant map-wide souls');
console.log('Partner enemy stacks: Omen/Clara/Ivy attack and damage both lanes without partner towers; reachable targets retain stacks; Omen death range remains spatial.');
