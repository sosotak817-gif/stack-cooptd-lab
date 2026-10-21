const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),H=require('./ui/stage-tools.js');
const c={console,URL,TextEncoder,TextDecoder,performance,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto};c.self=c;vm.createContext(c);
const realm=x=>vm.runInContext('JSON.parse',c)(JSON.stringify(x));c.structuredClone=realm;c.importScripts=(...ps)=>ps.forEach(p=>vm.runInContext(fs.readFileSync('dist'+p.split('?')[0],'utf8'),c));vm.runInContext(fs.readFileSync('dist/board-worker.js','utf8'),c);
let result;c.postMessage=d=>{if(d.kind==='stage-result'||d.error)result=d;};
async function analyze(input){await c.onmessage({data:realm(input)});assert.ok(!result.error,result.error);return result.reports;}
(async()=>{
 vm.runInContext(`var p=CoopPresets.newAccount(CoopEngine,CoopData);p.installWave=1;p.otherAtk=5000;p.perDemon.clara={level:21,lib:20,skinLevels:2,installWave:1,libWave:1,gems:[]};var sample={kind:'stages',stageModes:['deepsea'],compareAltars:false,you:p,partner:structuredClone(p),partnerEnabled:false,mode:'deepsea',cells:[{slug:'clara',row:6,col:4,lib:true}],marks:[]};`,c);
 const input=realm(c.sample),before=JSON.stringify(input),[r]=await analyze(input);
 assert.equal(JSON.stringify(input),before,'simulation must not modify the saved deck');
 const absorption=r.rows.find(w=>w.eaten>0);assert.ok(absorption,'real source-engine fixture must absorb surviving mobs');
 assert.ok(r.rows.some(w=>w.type==='Monster'&&w.remaining>0&&w.pass),'a real residual mob wave survives the clock');
 assert.ok(r.rows.some(w=>w.leaks>0&&w.pass),'a leak with remaining lives is not an instant loss');
 assert.equal(absorption.addedLayers,Math.trunc(c.CoopTargets.TARGET_BY_ID.get(absorption.id).shieldLayers/5)*absorption.eaten,'original boss absorption adds whole shield layers, not a multiplier on all HP');assert.ok(absorption.required>0);assert.equal(absorption.wave%10,0);
 assert.equal(r.rows.find(w=>w.cause).wave,r.firstRisk);assert.equal(r.contribution,null,'never invent final-boss capacity after an earlier death');
 const [solo]=await analyze({...input,stageBasis:'solo'});assert.equal(solo.basis,'solo','cache must distinguish solo from mirrored simulation');
 const reports=await analyze({...input,compareAltars:true});assert.equal(reports.length,2);assert.equal(reports[0].altar,'current');assert.equal(reports[1].altar,'none','identical altar stats must still retain comparison labels');
 // Controlled telemetry: ordinary clock expiry with carryover is a warning;
 // absorption converts old monster durability into the spawned boss pool.
 const T={lastWave:()=>100,TARGET_BY_ID:new Map([['m',{id:'m',type:'Monster'}],['b',{id:'b',type:'SpecialBoss'}]]),targetName:t=>t.id,waveTarget:(_,wave)=>({id:'m',type:'Monster',wave}),waveSeconds:()=>10};
 const trace=H.recorder(T,{tileIndex:()=>1,sideOf:()=>'you'},[{row:6,col:1}]);
 for(const event of [{kind:'spawn',tid:'m',pool:100},{kind:'waveStacks',wave:99},{kind:'gone',pool:40,fate:'cleared'},{kind:'ate',eaten:1,layers:20},{kind:'spawn',tid:'b',pool:1200},{kind:'hit',tid:'b',tower:'clara:1',dealt:600},{kind:'waveStacks',wave:100}])trace.event(event);
 const report=H.continuousReport({run:{waves:[{wave:99,target:'m',carryIn:0,leftover:40,leaks:0,lives:5,tracked:true,scheduled:10,seconds:10,sides:{you:{dealt:60}}},{wave:100,target:'b',carryIn:40,leftover:0,leaks:0,lives:5,tracked:true,scheduled:10,seconds:5,killAt:5,sides:{you:{dealt:600},partner:{dealt:600}}}],lives:{start:5,left:5}},mode:'deepsea',altar:'current',T,rounds:trace.rounds,basis:'mirror'});
 assert.equal(report.firstRisk,null);assert.equal(report.rows[98].pass,true);assert.equal(report.rows[98].warning,true);assert.equal(report.rows[99].required,1200,'do not count the erased monster again after its absorption');assert.equal(report.rows[99].eaten,1);assert.equal(report.rows[99].addedLayers,20);assert.equal(report.contribution.people,2);assert.equal(report.contribution.people.toFixed(1),'2.0');
 // Synthetic high damage fixture exercises successful 100R and source damage telemetry.
 const strong=realm(input);strong.you.otherAtk=1e12;strong.you.extraAtkSpd=1000;strong.cells=realm(c.CoopGeometry.tilesOf('you').map(t=>({slug:'clara',row:t.row,col:t.col,lib:true})));
 const [cleared]=await analyze(strong);assert.equal(cleared.passed,true);assert.ok(cleared.contribution.people>0);const k=cleared.contribution;assert.equal(k.people,k.ownDamage/k.seconds*k.window/k.requiredPerPerson);assert.ok(cleared.rows.at(-1).damage>0);
 const html=fs.readFileSync('dist/stages/index.html','utf8'),ui=fs.readFileSync('dist/stages-page.js','utf8');assert.ok(html.includes('id="stage-basis"'));assert.ok(ui.includes(".people.toFixed(1)+'인분"));assert.ok(html.includes('보호막 층수 ÷ 5'));assert.ok(html.includes('일반몹이 라운드 시간을 넘겨도 종료하지 않습니다'));
 console.log('Continuous stages: source-engine carryover, nonfatal clock and leaks, actual boss absorption, pool accounting, true game-over, solo/mirror and altar cache isolation, untouched input, 100R contribution formula and one-decimal display passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
