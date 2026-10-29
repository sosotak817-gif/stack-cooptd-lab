const fs=require('fs');
require('./dist/engine.js');
require('./ui/eggby-tools.js');
require('./ui/unit-tools.js');
require('./ui/dealer-tools.js');
const {CoopEngine:E,CoopData:D,CoopTargets:T,CoopUnitTools:H}=globalThis;
const sourceHash=require('./dealer-revision.cjs')();
const modes=['normal','hard','hell','abyss','deepsea'];
const growth=slug=>CoopDealerTools.growth(slug,D);
const accountFor=(slug,claraMode,mode,conditions)=>CoopDealerTools.account(E,D,claraMode,mode,conditions);
async function main(){
  const output={version:1,sourceHash,generatedAt:new Date().toISOString(),stackBasis:'mode reference deck progression; Clara/Ivy solve during boss combat',benchmark:{coinManGoldByMode:{normal:25000000,hard:25000000,hell:1000000,abyss:4000000,deepsea:25000000},coinManBikers:{liberated:1,unliberated:8},spaceSoldierStacks:15000,asuraLittleAsuras:10,asuraPartsEach:3,asuraUpgrades:5,eggbySupport:true},modes:{}};
  for(const mode of modes){
    const target=T.finalBossOf(mode),roster=D.demonsIn('supreme'),rows=[],conditions=require('./dealer-stack-build.cjs')(mode);
    for(const unit of roster){
      console.log(`${mode}: optimizing ${unit.slug}`);
      const slug=unit.slug,variants=slug==='clara'?['minigun','rocket']:[null];let winner=null;
      for(const claraMode of variants){
        const input=H.prepareFreeze({slug,mode,target:target.id,targetData:target,growth:growth(slug),includeEggby:true,account:accountFor(slug,claraMode,mode,conditions)},E,D,globalThis.CoopEggby);
        const optimized=['clara','ivy'].includes(slug)?H.recommend(input,E,D,globalThis.CoopEggby):await H.top(input,E,D,globalThis.CoopEggby),gems=optimized.rankings?.[0]?.gems||optimized.gems||[];
        const result=H.row(input,gems,E,D,globalThis.CoopEggby);
        const equipped=H.params(input,gems,E,D,globalThis.CoopEggby).perDemon[slug].gems;if(!D.NO_LIBERATION.has(slug)&&equipped.length!==3)throw Error(slug+': three equipped gems required');const row={slug,dps:result.dps,gems:equipped,level:growth(slug).level,effectiveLevel:result.stats.level,skinLevels:2,lib:growth(slug).lib,freezeShare:input.freezeProfile?.share||0,stackMethod:conditions.method,...(claraMode?{claraMode}:{})};
        if(!winner||row.dps>winner.dps)winner=row;
      }
      rows.push(winner);
      console.log(`${mode}: ${unit.slug} done`);
    }
    rows.sort((a,b)=>b.dps-a.dps||a.slug.localeCompare(b.slug));
    output.modes[mode]={target:target.id,conditions,rows};
    fs.writeFileSync('dist/dealer-rankings.json',JSON.stringify(output));
    console.log(`${mode}: ${rows.length} units ranked`);
  }
  fs.writeFileSync('dist/dealer-rankings.json',JSON.stringify(output));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
