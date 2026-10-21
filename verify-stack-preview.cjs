const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const c={console,URL,TextEncoder,TextDecoder,performance,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto};c.self=c;c.location={href:'http://localhost/board-worker.js'};vm.createContext(c);
 const realm=x=>vm.runInContext('JSON.parse',c)(JSON.stringify(x));c.structuredClone=realm;c.importScripts=(...paths)=>paths.forEach(p=>vm.runInContext(fs.readFileSync('dist'+p.split('?')[0],'utf8'),c));vm.runInContext(fs.readFileSync('ui/board-worker.js','utf8'),c);

 vm.runInContext(`var p=CoopPresets.newAccount(CoopEngine,CoopData);for(var slug of ['omen','clara','ivy'])p.perDemon[slug]={level:21,lib:20,gems:[]};var sample={you:p,partner:structuredClone(p),partnerEnabled:false,mode:'hell',target:CoopTargets.finalBossOf('hell').id,marks:[],cells:[],omenGrowth:true};`,c);
 for(const slug of ['omen','clara','ivy']){
  const input=realm({...c.sample,cells:[{slug,row:6,col:3,lib:true}]}),before=JSON.stringify(input),result=await c.calculate(input),row=result.stackEstimates[0];
  assert.equal(JSON.stringify(input),before);assert.ok(row.shots.you>0);assert.ok(row.shots.partner>0,'partner enemies count without a partner deck');
  if(slug==='omen')assert.ok(row.initialSouls>0);else{assert.ok(row.peak>0);assert.ok(row.peak>=row.last);assert.ok(row.samples>0);}
  const moved=realm(input);moved.cells[0].row=10;moved.cells[0].col=0;const other=(await c.calculate(moved)).stackEstimates[0];assert.notEqual(slug==='omen'?row.initialSouls:row.peak,slug==='omen'?other.initialSouls:other.peak,'stack estimates change with position');
  const cached=await c.calculate(input);assert.deepEqual(cached.stackEstimates,result.stackEstimates);assert.equal(cached.cached,true);
  const off=realm(input);off.omenGrowth=false;assert.equal((await c.calculate(off)).stackEstimates.length,0);
 }
 const recorder=c.stackRecorder(realm([{slug:'ivy',row:6,col:3}]));recorder.event({kind:'shot',tower:'you:ivy:45',lane:'partner',stackSnapshot:{ivy:12}});recorder.event({kind:'after',tower:'you:ivy:45',stackSnapshot:{ivy:0}});assert.equal(recorder.rows[0].peak,12);assert.equal(recorder.rows[0].last,0);assert.equal(recorder.rows[0].shots.partner,1);
 console.log('Live stack estimates: actual Omen/Clara/Ivy snapshots, both enemy lanes, peak/reset, immutable inputs, opt-out and cache passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
