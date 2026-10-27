const fs=require('fs');
require('./dist/engine.js');
require('./ui/eggby-tools.js');
require('./ui/unit-tools.js');
const {CoopEngine:E,CoopData:D,CoopTargets:T,CoopUnitTools:H}=globalThis;
const modes=['normal','hard','hell','abyss','deepsea'];
const growth=slug=>({level:D.maxLevelFor(slug),lib:D.NO_LIBERATION.has(slug)?0:20,skinLevels:2,relicLevel:32});
function accountFor(slug,claraMode){
  const a=structuredClone(E.DEFAULT_PARAMS);
  a.levelSupreme=a.levelDemonGod=a.levelOther=1;a.lib=0;a.skinLevels=0;
  a.relicLevel=32;a.eggbyAttached=false;a.heliEggby=false;a.bikerEggby=false;
  a.perDemon={};
  a.claraCount=1;a.claraInput='manual';a.claraStacks=2000;a.claraMode=claraMode||'minigun';
  a.ivyInput='manual';a.ivyStacks=3000;a.ivyWhispers=99;
  a.bikersUnliberated=0;a.bikersLiberated=slug==='goblin-biker'?1:0;
  Object.assign(a,{omenSouls:1e9,omenSoulsFortune:100,omenLord:true,omenLordMode:'finalGiants',omenLordWave:1,gold:1e12,startGold:1e12,cannonBossKills:9999,catStacks:2000,catAllyHits:0,mouseStacks:1e6,mouseStacksFortune:100,spaceStacks:1e6,scalluckPlus:99,slimePlus:99,asuraHeads:999,asuraBodies:999,asuraArms:999,asuraLegs:999,asuraLittles:999,asuraUpgrades:99,heliMoves:999});
  a.freezeSetup={enabled:true,level:D.maxLevelFor('ice-knight'),lib:20,skinLevels:2,relicLevel:32,frostGrade:'SSS',extraSeconds:30};
  return a;
}
async function main(){
  const output={version:1,generatedAt:new Date().toISOString(),stackBasis:'isolated-unit; never reads or accepts user board/deck state',modes:{}};
  for(const mode of modes){
    const target=T.finalBossOf(mode),roster=D.demonsIn('supreme'),rows=[];
    for(const unit of roster){
      console.log(`${mode}: optimizing ${unit.slug}`);
      const slug=unit.slug,variants=slug==='clara'?['minigun','rocket']:[null];let winner=null;
      for(const claraMode of variants){
        const input=H.prepareFreeze({slug,mode,target:target.id,targetData:target,growth:growth(slug),account:accountFor(slug,claraMode)},E,D,globalThis.CoopEggby);
        const optimized=slug==='clara'?H.recommend(input,E,D,globalThis.CoopEggby):await H.top(input,E,D,globalThis.CoopEggby),gems=optimized.rankings?.[0]?.gems||optimized.gems||[];
        const result=H.row(input,gems,E,D,globalThis.CoopEggby);
        const row={slug,dps:result.dps,gems,level:growth(slug).level,lib:growth(slug).lib,freezeShare:input.freezeProfile?.share||0,stackMethod:'isolated-model-caps',...(claraMode?{claraMode}:{})};
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
