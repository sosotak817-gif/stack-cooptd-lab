const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{load}=require('./inspect.cjs');
(async()=>{
 const R=load(5706),C=load(85267),G=load(21428);
 assert.equal(R.SPOTLIGHT_LIB,6);assert.equal(R.SPOTLIGHT_REACH,1);assert.equal(R.SPOTLIGHT_BONUS,1);
 const tower={at:{x:0,y:0},fixed:false},mouse={at:{x:1,y:1},mouse:{state:R.AWAKE},liberated:true};
 assert.equal(R.holdsSpot(mouse,5),false);assert.equal(R.holdsSpot(mouse,6),true);assert.equal(R.holdsSpot({...mouse,liberated:false},20),false);
 assert.equal(C.litBy(tower,[mouse]),true,'diagonal neighbor is in the aura');assert.equal(C.litBy(tower,[{...mouse,at:{x:2,y:1}}]),false,'distance two is outside');assert.equal(C.litBy(tower,[{...mouse,mouse:{state:R.CALM}}]),false,'exhaustion disables the range aura');assert.equal(C.litBy({...tower,fixed:true},[mouse]),false,'fixed range is excluded');
 assert.equal(R.litRange({range:2,dominion:false},C.litBy(tower,[mouse,mouse])),3,'multiple sources do not add extra range');assert.equal(R.litRange({range:2,dominion:true},true),2,'Dominion retains its own range model');
 const c={console,URL,TextEncoder,TextDecoder,performance,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto};c.self=c;c.location={href:'http://localhost/board-worker.js'};vm.createContext(c);const realm=x=>vm.runInContext('JSON.parse',c)(JSON.stringify(x));c.structuredClone=realm;c.importScripts=(...paths)=>paths.forEach(p=>vm.runInContext(fs.readFileSync('dist'+p.split('?')[0],'utf8'),c));vm.runInContext(fs.readFileSync('ui/board-worker.js','utf8'),c);
 vm.runInContext(`var account=CoopPresets.newAccount(CoopEngine,CoopData);account.relics={};account.altar={};account.claraLib='focus';account.claraMode='minigun';account.claraInput='solve';account.ivyInput='solve';for(const slug of ['omen','clara','ivy','surprise-mouse'])account.perDemon[slug]={level:21,lib:20,relicLevel:0,gems:[]};var sample={you:account,partner:structuredClone(account),partnerEnabled:false,mode:'deepsea',target:CoopTargets.finalBossOf('deepsea').id,marks:[],cells:[],omenGrowth:false};`,c);
 const fixtures=[['omen',{row:6,col:1},{row:6,col:2}],['clara',{row:8,col:3},{row:7,col:3}],['ivy',{row:10,col:0},{row:9,col:0}]],records=[];
 for(const [slug,at,near]of fixtures){
  const input=realm({...c.sample,cells:[{slug,...at,lib:true,nolib:false},{slug:'surprise-mouse',...near,lib:true,nolib:false}]}),before=JSON.stringify(input),on=await c.calculate(input),far=realm(input);far.cells[1].row=6;far.cells[1].col=5;const off=await c.calculate(far),low=realm(input);low.you.perDemon['surprise-mouse'].lib=5;const locked=await c.calculate(low),pick=r=>r.units.find(u=>u.slug===slug);
  assert.equal(pick(off).cover,0);assert.equal(pick(off).dps,0);assert.equal(pick(locked).cover,0);assert.ok(pick(on).cover>0&&pick(on).cover<1,'only the awake portion enables the extra reach');assert.ok(pick(on).dps>0);assert.equal(JSON.stringify(input),before);
  records.push({slug,tile:G.tileName(at.row*7+at.col),mouse:G.tileName(near.row*7+near.col),without:pick(off).cover,withMouse:pick(on).cover,targetDps:pick(on).dps});
 }
 console.log('Mouse aura: original lib threshold, diagonal/remote distance, awake/exhausted state, nonstacking/fixed/Dominion rules and three actual board DPS cases passed.');console.table(records);
})().catch(e=>{console.error(e);process.exitCode=1});
