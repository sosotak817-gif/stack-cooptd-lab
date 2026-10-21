const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),O=require('./ui/optimizer-core.js');
(async()=>{
 const c={console,URL,TextEncoder,TextDecoder,performance,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto};c.self=c;c.location={href:'http://localhost/board-worker.js'};vm.createContext(c);
 const realm=x=>vm.runInContext('JSON.parse',c)(JSON.stringify(x));c.structuredClone=realm;c.importScripts=(...paths)=>paths.forEach(p=>vm.runInContext(fs.readFileSync('dist'+p.split('?')[0],'utf8'),c));vm.runInContext(fs.readFileSync('ui/board-worker.js','utf8'),c);


 const failed={actual:1e30,progression:{reachedFinal:false,reachedWave:90}},farther={actual:1,progression:{reachedFinal:false,reachedWave:99}},reached={actual:100,progression:{reachedFinal:true,reachedWave:100}},higher={actual:100.0000001,progression:{reachedFinal:true,reachedWave:100}};
 assert.ok(O.compare(reached,failed)>0);assert.ok(O.compare(farther,failed)>0);assert.ok(O.compare(higher,reached)>0);assert.ok(O.compare({actual:2},{actual:1})>0);
 const updates=[],search=await O.optimize({cells:[{slug:'clara',row:6,col:1}],marks:[],tiles:{you:[1,2,3].map(col=>({row:6,col})),partner:[]},movableSides:['you'],maxEvaluations:15,timeLimit:2000,evaluate:async cells=>structuredClone(cells[0].col===1?failed:cells[0].col===2?reached:higher),checkpoints:true,onProgress:p=>updates.push(p)});
 assert.equal(search.cells[0].col,3);assert.ok(search.result.actual<search.baseline,'a reachable candidate beats unreachable inflated DPS');assert.ok(updates.some(p=>p.checkpoint.result.progression.reachedFinal));
 vm.runInContext(`var p=CoopPresets.newAccount(CoopEngine,CoopData);p.relics={};p.altar={};p.perDemon['ice-knight']={level:21,lib:20,gems:[]};var sample={you:p,partner:structuredClone(p),partnerEnabled:false,mode:'hell',target:CoopTargets.finalBossOf('hell').id,marks:[],cells:[{slug:'ice-knight',row:6,col:5,lib:true}],omenGrowth:true,fullProgress:true};`,c);
 const input=realm(c.sample),before=JSON.stringify(input),boss=c.CoopBoss;let options,run;
 c.CoopBoss={...boss,bossRun:(...args)=>{run=boss.bossRun(...args);return run;},computeBossBoard:(cells,p,o)=>{options=o;return boss.computeBossBoard(cells,p,o);}};
 const result=await c.calculate(input);assert.equal(JSON.stringify(input),before);assert.ok(result.progression);assert.equal(result.progression.targetWave,100);assert.ok(result.progression.roundsSimulated>0,'full round simulation runs even without Omen/Mouse/Clara/Ivy');assert.equal(result.progression.reachedFinal,!run.gameOver);assert.equal(options.full,true);assert.equal(options.run,run.banks);assert.deepEqual(options.held,run.banks.held);
 if(run.gameOver){assert.equal(result.progression.reachedWave,run.gameOver.wave);assert.equal(result.progression.reason,run.gameOver.why);}
 const normal=realm(input);normal.fullProgress=false;const plain=await c.calculate(normal);assert.equal(plain.progression,null);assert.equal((await c.calculate(input)).cached,true);
 const html=fs.readFileSync('ui/board.html','utf8'),ui=fs.readFileSync('ui/board-app.js','utf8');assert.ok(html.includes('id="compose-omen-growth" type="checkbox" checked disabled'));assert.ok(ui.includes('fullProgress:!!state.fullProgress'));assert.ok(ui.includes('CoopOptimize.compare(data.checkpoint.result,composeLast.checkpoint.result)>0'));assert.ok(ui.includes('state.fullProgress=!!proposal.result.progression'));
 console.log('Full progression recommendation: reachability beats inflated DPS, further failed wave wins, precise final DPS ordering, real all-round run without stack units, original bank/held integration, failure evidence, cache separation and apply transport passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
