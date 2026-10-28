const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c={console,URL,URLSearchParams,TextEncoder,TextDecoder,Buffer,performance,setTimeout,clearTimeout,structuredClone};
c.self=c;c.location={href:'https://example.test/unit-worker.js'};vm.createContext(c);
c.importScripts=(...paths)=>paths.forEach(p=>vm.runInContext(fs.readFileSync('dist'+p.split('?')[0],'utf8'),c));
vm.runInContext(fs.readFileSync('dist/unit-worker.js','utf8'),c);
c.assert=assert;c.benchmark=process.argv.includes('--benchmark');
vm.runInContext(`(async()=>{
 const E=CoopEngine,D=CoopData,H=CoopUnitTools,Egg=CoopEggby,t=CoopTargets.finalBossOf('deepsea');
 const account=JSON.parse(JSON.stringify(E.DEFAULT_PARAMS));
 account.freezeSetup={enabled:true,level:21,lib:20,skinLevels:2,relicLevel:32,frostGrade:'SSS',extraSeconds:0};
 const raw={slug:'clara',mode:t.mode,target:t.id,targetData:t,growth:{level:21,lib:20,skinLevels:2,relicLevel:32},account};
 let at=performance.now();const input=H.prepareFreeze(raw,E,D,Egg),prepareMs=performance.now()-at,before=JSON.stringify(input);
 const suppression=[{id:'suppression',grade:'SSS'}],glacier=[{id:'glacier',grade:'SSS'}];
 const manual=stun=>({...input,account:{...input.account,holdShares:{stun}}});
 assert.equal(H.params(input,suppression,E,D,Egg).holdShares.stun,0);
 assert.equal(H.params(manual(.4),suppression,E,D,Egg).holdShares.stun,.4);
 assert.equal(H.params(manual(null),suppression,E,D,Egg).holdShares.stun,0);
 assert.equal(H.row(input,suppression,E,D,Egg).dps,H.row(manual(0),suppression,E,D,Egg).dps);
 assert.ok(H.row(manual(.4),suppression,E,D,Egg).dps>H.row(input,suppression,E,D,Egg).dps);
 const originalGlacier=H.row(input,glacier,E,D,Egg).dps;
 if(benchmark){
  const fixedParams=H.params,gems=H.gems,root=globalThis;
  // Recreate the previous implementation only in this disposable VM.
  const legacySource=fixedParams.toString().replace('stun:p.holdShares?.stun??0,','');
  const originalSource=H.row.toString().replace('params(input,picks,E,D,H)','('+legacySource+')(input,picks,E,D,H)');
  const legacyRow=eval('('+originalSource+')');at=performance.now();
  const legacy=legacyRow(input,suppression,E,D,Egg);
  console.log({legacySuppressionMs:performance.now()-at,legacyDps:String(legacy.dps)});
  assert.ok(Number.isNaN(legacy.dps));
  assert.equal(legacyRow(input,glacier,E,D,Egg).dps,originalGlacier);
 }
 at=performance.now();for(let i=0;i<10;i++)H.row(input,suppression,E,D,Egg);
 console.log({prepareMs,fixedSuppressionMeanMs:(performance.now()-at)/10});
 let count=0,suppressionCount=0;
 const checked={...E,computeDemon(d,p){const r=E.computeDemon(d,p);assert.ok(Number.isFinite(r.dps),d.slug+' must return finite DPS');count++;if(p.perDemon[d.slug].gems.some(g=>g.id==='suppression'))suppressionCount++;return r;}};
 at=performance.now();const full=await H.top(input,checked,D,Egg);const freezeMs=performance.now()-at;
 assert.equal(full.evaluated,6090);assert.equal(count,6090);assert.ok(suppressionCount>0);
 for(const r of full.rankings)assert.equal(r.dps,H.row(manual(0),r.gems,E,D,Egg,true).dps);
 assert.equal(JSON.stringify(input),before);
 console.log({freezeMs,evaluated:count,suppressionCount,topDps:full.rankings[0].dps});
 if(benchmark){at=performance.now();await H.top({...raw,account:{...account,freezeSetup:{enabled:false}}},E,D,Egg);console.log({freezeOffMs:performance.now()-at});}
 console.log('Freeze search: finite DPS for all 6090 candidates, suppression coverage, existing stun share, unchanged glacier and input verified.');
})()`,c).catch(error=>{console.error(error);process.exitCode=1;});
