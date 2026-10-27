const fs=require('fs');
require('./dist/engine.js');
require('./ui/eggby-tools.js');
require('./ui/unit-tools.js');
const {CoopEngine:E,CoopData:D,CoopTargets:T,CoopUnitTools:H}=globalThis;
const sourceHash=require('crypto').createHash('sha256').update(fs.readFileSync('dist/engine.js')).update(fs.readFileSync('ui/unit-tools.js')).update(fs.readFileSync(__filename)).digest('hex');
const modes=['normal','hard','hell','abyss','deepsea'];
const growth=slug=>({level:D.maxLevelFor(slug),lib:D.NO_LIBERATION.has(slug)?0:20,skinLevels:2,relicLevel:32});
function accountFor(slug,claraMode){
  const a=structuredClone(E.DEFAULT_PARAMS);
  a.gold=30_000_000;
  a.spaceStacks=15_000;
  a.asuraHeads=a.asuraBodies=a.asuraArms=a.asuraLegs=1;
  a.asuraLittles=10;
  a.asuraUpgrades=5;
  if(claraMode)a.claraMode=claraMode;
  a.freezeSetup={enabled:true,level:D.maxLevelFor('ice-knight'),lib:20,skinLevels:2,relicLevel:32,frostGrade:'SSS',extraSeconds:30};
  return a;
}
async function main(){
  const output={version:1,sourceHash,generatedAt:new Date().toISOString(),stackBasis:'fixed official Max preset values; independent from user board/deck',benchmark:{coinManGold:30000000,coinManBikers:{liberated:1,unliberated:8},spaceSoldierStacks:15000,asuraLittleAsuras:10,asuraPartsEach:3,asuraUpgrades:5,eggbySupport:true},modes:{}};
  for(const mode of modes){
    const target=T.finalBossOf(mode),roster=D.demonsIn('supreme'),rows=[];
    for(const unit of roster){
      console.log(`${mode}: optimizing ${unit.slug}`);
      const slug=unit.slug,variants=slug==='clara'?['minigun','rocket']:[null];let winner=null;
      for(const claraMode of variants){
        const input=H.prepareFreeze({slug,mode,target:target.id,targetData:target,growth:growth(slug),includeEggby:true,account:accountFor(slug,claraMode)},E,D,globalThis.CoopEggby);
        const optimized=['clara','ivy'].includes(slug)?H.recommend(input,E,D,globalThis.CoopEggby):await H.top(input,E,D,globalThis.CoopEggby),gems=optimized.rankings?.[0]?.gems||optimized.gems||[];
        const result=H.row(input,gems,E,D,globalThis.CoopEggby);
        const row={slug,dps:result.dps,gems,level:growth(slug).level,lib:growth(slug).lib,freezeShare:input.freezeProfile?.share||0,stackMethod:'official-max-preset',...(claraMode?{claraMode}:{})};
        if(!winner||row.dps>winner.dps)winner=row;
      }
      rows.push(winner);
      console.log(`${mode}: ${unit.slug} done`);
    }
    rows.sort((a,b)=>b.dps-a.dps||a.slug.localeCompare(b.slug));
    output.modes[mode]={target:target.id,rows};
    fs.writeFileSync('dist/dealer-rankings.json',JSON.stringify(output));
    console.log(`${mode}: ${rows.length} units ranked`);
  }
  fs.writeFileSync('dist/dealer-rankings.json',JSON.stringify(output));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
