const fs=require('node:fs'),crypto=require('node:crypto');
require('./dist/engine.js');
const P=require('./ui/board-presets.js'),Egg=require('./ui/eggby-tools.js'),H=require('./ui/unit-tools.js'),C=require('./ui/unit-cache.js');
const {CoopEngine:E,CoopData:D,CoopTargets:T}=globalThis;
// A calculation revision changes only with data/formulas, never CSS or patch notes.
const version=require('./unit-revision.cjs')(),calcRevision=version.revision;
async function main(){
 fs.writeFileSync('dist/unit-calculation-version.js','globalThis.COOP_UNIT_REVISION='+JSON.stringify(calcRevision)+';globalThis.COOP_UNIT_VERSION='+JSON.stringify(version)+';');
 fs.writeFileSync('server/unit-calculation-version.mjs','export const revision='+JSON.stringify(calcRevision)+';\nexport const balanceVersion='+JSON.stringify(version.balanceVersion)+';\n');
 const schema=2,sourceHash=crypto.createHash('sha256').update(calcRevision).update(fs.readFileSync(__filename,'utf8').replace(/\r\n/g,'\n')).update(fs.readFileSync('ui/board-presets.js','utf8').replace(/\r\n/g,'\n')).digest('hex');let previous;try{previous=JSON.parse(fs.readFileSync('dist/unit-top-defaults.json'));}catch{}
 const entries=previous?.revision===calcRevision?previous.entries:{},expected=new Set,jobs=[];
 for(const mode of ['normal','hard','hell','abyss','deepsea'])for(const unit of D.demonsIn('supreme')){
  const target=T.finalBossOf(mode),base=P.newAccount(E,D);base.eggbyAttached=base.heliEggby=base.bikerEggby=false;
  const growth={level:21,lib:20,skinLevels:2,relicLevel:base.perDemon[unit.slug]?.relicLevel??base.relicLevel??0};
  const profiles=[{enabled:false},{enabled:true,level:21,lib:20,skinLevels:2,relicLevel:11,frostGrade:'',extraSeconds:0}];profiles.push({enabled:true,level:21,lib:20,skinLevels:2,relicLevel:11,frostGrade:'SSS',extraSeconds:0});
  for(const freezeSetup of profiles){
   const raw={slug:unit.slug,mode,target:target.id,targetData:target,growth,account:{...base,freezeSetup}},key=await C.key(raw,E,Egg,calcRevision);expected.add(key);if(entries[key]&&C.valid(entries[key]))continue;
   const {targetData,...serializable}=raw;jobs.push({key,raw:serializable,mode,slug:unit.slug,freeze:freezeSetup.enabled});
  }
 }
 const dealer=require('./ui/dealer-tools.js'),catalog=JSON.parse(fs.readFileSync('dist/dealer-rankings.json','utf8'));
 for(const mode of ['normal','hard','hell','abyss','deepsea'])for(const claraMode of ['minigun','rocket'])for(const standardFreeze of [false,true]){
  const target=T.finalBossOf(mode),account=dealer.account(E,D,claraMode,mode,catalog.modes[mode].conditions);
  if(standardFreeze)account.freezeSetup={enabled:true,level:21,lib:20,skinLevels:2,relicLevel:11,frostGrade:'',extraSeconds:0};
  const raw={slug:'clara',mode,target:target.id,growth:dealer.growth('clara',D),includeEggby:true,account},key=await C.key(raw,E,Egg,calcRevision);
  expected.add(key);if(entries[key]&&C.valid(entries[key]))continue;
  jobs.push({key,raw,mode,slug:'clara '+claraMode,freeze:true});
 }
 await require('./unit-precompute-pool.cjs')(jobs,(job,result)=>{entries[job.key]={...result,revision:calcRevision,updatedAt:Date.now(),kind:'top'};console.log('Precomputed TOP 5:',job.mode,job.slug,job.freeze?'ice+frost':'default');fs.writeFileSync('dist/unit-top-defaults.json',JSON.stringify({schema,sourceHash,version,revision:calcRevision,entries}));});
 const freezeEntries={};
 for(const mode of ['normal','hard','hell','abyss','deepsea'])for(const pressureLv of mode==='deepsea'?[1,2,3,4,5]:[1])for(const frostGrade of ['',...D.GRADES])for(const extraSeconds of [0,5,10,15,20,25,30]){
  const target=T.finalBossOf(mode),account={...P.newAccount(E,D),pressureLv,freezeSetup:{enabled:true,level:21,lib:20,skinLevels:2,relicLevel:11,frostGrade,extraSeconds}},raw={slug:'ice-knight',mode,target:target.id,targetData:target,account},basis=H.freezeBasis(raw,E,D,Egg),key=await C.freezeProfileKey(basis,calcRevision);
  freezeEntries[key]??={kind:'freeze',revision:calcRevision,updatedAt:Date.now(),profile:H.solveFreeze(basis)};
 }
 fs.writeFileSync('dist/unit-freeze-defaults.json',JSON.stringify({schema:1,version,revision:calcRevision,entries:freezeEntries}));
 console.log('Precomputed freeze profiles:',Object.keys(freezeEntries).length);
 const selected=Object.fromEntries([...expected].map(key=>[key,entries[key]]));
 fs.writeFileSync('dist/unit-top-defaults.json',JSON.stringify({schema,sourceHash,version,revision:calcRevision,entries:selected}));
 console.log('Recommendation cache:',expected.size,'exact-condition presets');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
