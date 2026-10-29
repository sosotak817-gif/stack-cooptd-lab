const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
require('./dist/engine.js');
const F=require('./ui/dealer-tools.js'),C=require('./ui/unit-cache.js'),Egg=require('./ui/eggby-tools.js'),catalog=JSON.parse(fs.readFileSync('dist/dealer-rankings.json')),cache=JSON.parse(fs.readFileSync('dist/unit-top-defaults.json'));
async function main(){
 const cases=[];
 for(const mode of ['normal','hard','hell','abyss','deepsea'])for(const claraMode of ['minigun','rocket'])for(const standardFreeze of [false,true]){
  const target=CoopTargets.finalBossOf(mode),account=F.account(CoopEngine,CoopData,claraMode,mode,catalog.modes[mode].conditions);
  assert.equal(account.freezeSetup.extraSeconds,0,'tier preset must not add extra freeze time');
  if(standardFreeze)account.freezeSetup={enabled:true,level:21,lib:20,skinLevels:2,relicLevel:11,frostGrade:'',extraSeconds:0};
  const raw={slug:'clara',mode,target:target.id,growth:F.growth('clara',CoopData),includeEggby:false,account},key=await C.key(raw,CoopEngine,Egg,cache.revision),result=cache.entries[key];
  assert.ok(C.valid(result),mode+' '+claraMode+' must be publicly precomputed');assert.equal(result.evaluated,6090);assert.ok(result.freezeProfile.stunShare>0);cases.push({raw,key,result});
 }
 const selected=cases.find(c=>c.raw.mode==='deepsea'&&c.raw.account.claraMode==='rocket'&&c.raw.account.freezeSetup.frostGrade==='');
 for(let browser=0;browser<2;browser++){
  const c={console,URL,TextEncoder,TextDecoder,Buffer,performance,setTimeout,clearTimeout,AbortController,crypto:webcrypto};c.self=c;c.location={href:'https://test/unit-worker.js'};vm.createContext(c);c.structuredClone=x=>vm.runInContext('JSON.parse',c)(JSON.stringify(x));c.importScripts=(...paths)=>paths.forEach(p=>vm.runInContext(fs.readFileSync('dist'+p.split('?')[0],'utf8'),c));vm.runInContext(fs.readFileSync('dist/unit-worker.js','utf8'),c);
  assert.equal(c.dealerBenchmarkAccount().freezeSetup.extraSeconds,0,'Worker tier defaults match the UI');
  let engineCalls=0,solves=0,searches=0;const E=c.CoopEngine,H=c.CoopUnitTools;c.CoopEngine={...E,computeDemon(){engineCalls++;throw Error('cache hit must not call engine');}};c.CoopUnitTools={...H,solveFreeze(){solves++;throw Error('cache hit must not solve controls');},top(){searches++;throw Error('cache hit must not search');}};
  c.fetch=async url=>({ok:true,json:async()=>c.structuredClone(String(url).includes('/api/')?{result:selected.result,source:'shared-db'}:cache)});
  let reply;c.postMessage=m=>reply=m;const at=performance.now();await c.onmessage({data:c.structuredClone({...selected.raw,kind:'top',id:browser+1,cacheToken:String(browser+1).repeat(64)})});
  assert.ok(!reply.error,reply.error);assert.equal(reply.cached,true);assert.equal(reply.evaluated,6090);assert.equal(reply.rankings[0].dps,selected.result.rankings[0].dps);assert.equal(engineCalls,0);assert.equal(solves,0);assert.equal(searches,0);console.log({browser:browser+1,ms:performance.now()-at,engineCalls,solves,searches});
 }
 console.log('Clara cache: all five modes, minigun/rocket and both control setups covered; two fresh browser Workers skip all engine/control/stack search calls.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
