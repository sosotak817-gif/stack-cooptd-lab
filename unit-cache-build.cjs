const fs=require('node:fs'),crypto=require('node:crypto');
require('./dist/engine.js');
const P=require('./ui/board-presets.js'),Egg=require('./ui/eggby-tools.js'),H=require('./ui/unit-tools.js'),C=require('./ui/unit-cache.js');
const {CoopEngine:E,CoopData:D,CoopTargets:T}=globalThis;
// A calculation revision changes only with data/formulas, never CSS or patch notes.
const revision=crypto.createHash('sha256');for(const f of ['dist/engine.js','ui/eggby-tools.js','ui/unit-tools.js','ui/unit-cache.js'])revision.update(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n'));const calcRevision=revision.digest('hex');
async function main(){
 fs.writeFileSync('dist/unit-calculation-version.js','globalThis.COOP_UNIT_REVISION='+JSON.stringify(calcRevision)+';');
 fs.writeFileSync('server/unit-calculation-version.mjs','export const revision='+JSON.stringify(calcRevision)+';\n');
 const schema=2,sourceHash=crypto.createHash('sha256').update(calcRevision).update(fs.readFileSync(__filename,'utf8').replace(/\r\n/g,'\n')).update(fs.readFileSync('ui/board-presets.js','utf8').replace(/\r\n/g,'\n')).digest('hex');let previous;try{previous=JSON.parse(fs.readFileSync('dist/unit-top-defaults.json'));}catch{}
 const entries=previous?.sourceHash===sourceHash?previous.entries:{},expected=new Set;
 for(const mode of ['normal','hard','hell','abyss','deepsea'])for(const unit of D.demonsIn('supreme')){
  const target=T.finalBossOf(mode),base=P.newAccount(E,D);base.eggbyAttached=base.heliEggby=base.bikerEggby=false;
  const growth={level:21,lib:20,skinLevels:2,relicLevel:base.perDemon[unit.slug]?.relicLevel??base.relicLevel??0};
  const profiles=[{enabled:false}];if(unit.slug==='clara')profiles.push({enabled:true,level:21,lib:20,skinLevels:2,relicLevel:32,frostGrade:'SSS',extraSeconds:0});
  for(const freezeSetup of profiles){
   const raw={slug:unit.slug,mode,target:target.id,targetData:target,growth,account:{...base,freezeSetup}},key=await C.key(raw,E,Egg,calcRevision);expected.add(key);if(entries[key]&&C.valid(entries[key]))continue;
   const input=H.prepareFreeze(raw,E,D,Egg),result=await H.top(input,E,D,Egg);
   for(const row of result.rankings){const checked=H.row(input,row.gems,E,D,Egg);row.dps=checked.dps;}
   result.rankings.sort(H.compareDps);entries[key]={...result,freezeProfile:input.freezeProfile,revision:calcRevision,updatedAt:Date.now(),kind:'top'};
   console.log('Precomputed TOP 5:',mode,unit.slug,freezeSetup.enabled?'ice+frost':'default');
  }
 }
 const selected=Object.fromEntries([...expected].map(key=>[key,entries[key]]));
 fs.writeFileSync('dist/unit-top-defaults.json',JSON.stringify({schema,sourceHash,revision:calcRevision,entries:selected}));
 console.log('Recommendation cache:',expected.size,'exact-condition presets');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
