const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const c={console,URL,TextEncoder,TextDecoder,performance,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto};c.self=c;c.location={href:'http://localhost/board-worker.js'};vm.createContext(c);
 const realm=x=>vm.runInContext('JSON.parse',c)(JSON.stringify(x));c.structuredClone=realm;c.importScripts=(...paths)=>paths.forEach(p=>vm.runInContext(fs.readFileSync('dist'+p.split('?')[0],'utf8'),c));vm.runInContext(fs.readFileSync('ui/board-worker.js','utf8'),c);
 vm.runInContext(`const you=CoopPresets.newAccount(CoopEngine,CoopData);for(const slug of ['omen','surprise-mouse'])you.perDemon[slug]={level:21,lib:20,relicLevel:32,gems:[]};var sample={you,partner:structuredClone(you),partnerEnabled:false,mode:'deepsea',target:CoopTargets.finalBossOf('deepsea').id,marks:[],cells:[{slug:'omen',row:6,col:3,lib:true},{slug:'surprise-mouse',row:6,col:2,lib:true}],omenGrowth:true};`,c);
 const before=JSON.stringify(c.sample),near=await c.calculate(c.sample),farInput=realm(c.sample);farInput.cells[1].col=6;const far=await c.calculate(farInput);
 assert.equal(near.omenAuto,true);assert.ok(near.omenGrowth[0].souls>far.omenGrowth[0].souls,'Mouse position changes Omen accumulated souls through original attack/reach events');assert.notEqual(near.actual,far.actual);
 const manual=await c.calculate(realm({...c.sample,omenGrowth:false}));assert.equal(manual.omenAuto,false);assert.equal(manual.cached,false,'auto/manual stock caches must be isolated');assert.equal((await c.calculate(c.sample)).cached,true);assert.equal(JSON.stringify(c.sample),before);
 console.log('Omen original round accumulation:',{near:near.omenGrowth[0].souls,far:far.omenGrowth[0].souls,nearDps:near.actual,farDps:far.actual});
})().catch(e=>{console.error(e.message);process.exitCode=1});
