const fs=require('fs'),path=require('path');
const {load,modules,cache}=require('./inspect.cjs');
const {KAISER,kaiserModel,applyKaiserData}=require('./kaiser-data.cjs');
const root='.',dist=path.join(root,'dist');fs.mkdirSync(dist,{recursive:true});
fs.cpSync(path.join(root,'original'),dist,{recursive:true});
// Archive portraits use display names while engine slugs retain historical IDs.
for(const [alias,source] of [['space-solider','space-soldier'],['latest-helicopter-machine','helicopter'],['natures-guardian','guardian-of-nature']])fs.copyFileSync(path.join(dist,'assets/units',source+'.webp'),path.join(dist,'assets/units',alias+'.webp'));
const engine=load(98018),data=load(12640),ds=load(34621),extras=load(86245);
load(5706);load(24012);load(90656);load(16871);load(65335);load(49460);load(56584);load(21428);load(1503);load(9469);
applyKaiserData(data,ds.DEMONS,ds.LIBERATION_DATA,load(56584),load(42389));
const plain={source:'https://coop-tools.vercel.app/',collectedAt:new Date().toISOString(),scope:'Public browser-delivered data and JavaScript; not the private source repository or server code.',...data,demons:ds.DEMONS,gems:ds.GEMS,liberation:ds.LIBERATION_DATA,defaults:engine.DEFAULT_PARAMS,traits:extras.TRAITS};
fs.writeFileSync(path.join(root,'data.json'),JSON.stringify(plain,null,2));fs.copyFileSync(path.join(root,'data.json'),path.join(dist,'data.json'));
for(const d of ds.DEMONS)if(d.slug!=='kaiser')engine.computeDemon(d,structuredClone(engine.DEFAULT_PARAMS));
// Optional telemetry and stage-only damage benchmarks. With no benchmark option,
// combat arithmetic remains identical to the archived engine.
function diagnosticFactory(f,id){let source=f.toString();if(id===56584){source=source.replace('function m(e,a){','function m(e,a={}){');}if(id===98018){
 const dispatch='let E=aL[e.slug]??';
 if(!source.includes(dispatch))throw Error('Kaiser model insertion point changed');
 const inject=`aL.kaiser=${kaiserModel.toString()};if("kaiser"!==e.slug&&Number.isFinite(F.p.domination)&&F.p.domination>0){F.baseAtk=F.whiteAtk(F.p.domination);ap(F,"Kaiser's Domination","baseAtk",F.p.domination)}if("kaiser"!==e.slug&&Number.isFinite(F.p.kaiserGracePct)&&F.p.kaiserGracePct>0){F.atkPct+=F.p.kaiserGracePct;ap(F,"Kaiser Grace ×"+(F.p.kaiserGraceWaves||1),"atkPct",F.p.kaiserGracePct);F.critMult+=F.p.kaiserGracePct/100;ap(F,"Kaiser Grace ×"+(F.p.kaiserGraceWaves||1),"critDmg",F.p.kaiserGracePct)}`;
 source=source.replace(dispatch,inject+';'+dispatch);
 const gems='ivy:["legion","awakening","waves"]';
 if(!source.includes(gems))throw Error('Kaiser gem recommendation insertion point changed');
 source=source.replace(gems,gems+',kaiser:["precision","awakening","supremacy"]');
 }if(id===49460){
 const markAnchor='H=w.marks??ei.NO_MARKS,j=';
 if(!source.includes(markAnchor))throw Error('Kaiser aura helper insertion point changed');
 const helper=`H=w.marks??ei.NO_MARKS,kA=(cell,account)=>{const side=(0,c.sideOf)(cell.row),domination=e.reduce((sum,placed)=>{if(placed.slug!=="kaiser")return sum;const team=(0,c.sideOf)(placed.row),build=rG(g,team,w),level=(0,t.effectiveLevel)(build,"kaiser");return sum+Math.trunc(5+.5*(level-1))},0),placed=e.filter(unit=>unit.slug==="kaiser"&&(0,c.sideOf)(unit.row)===side),kaiser=placed.find(unit=>!unit.nolib)||placed[0],lib=kaiser&&!kaiser.nolib?(0,t.effectiveLib)(account,"kaiser"):0,maximum=lib>=11?4:lib>=1?2:1,graceMarks=H.filter(mark=>mark.grace&&(0,c.sideOf)(mark.row)===side).slice(0,maximum),active=placed.length>0&&graceMarks.some(mark=>mark.row===cell.row&&mark.col===cell.col);if(!active)return domination>0?{domination}:{};const level=(0,t.effectiveLevel)(account,"kaiser"),waves=Math.max(1,Math.floor(account.wave||1)-Math.max(1,Math.floor(account.installWave||1))+1),grace=Math.trunc(5+(level-1))*waves;return{...(domination>0?{domination}:{}),kaiserGracePct:grace,kaiserGraceWaves:waves}},j=`;
 source=source.replace(markAnchor,helper);
 const unitParams='...w?{regikAuras:w}:{},...i?{heliMoves:';
 if(!source.includes(unitParams))throw Error('Kaiser aura unit-parameter insertion point changed');
 source=source.replace(unitParams,'...w?{regikAuras:w}:{},...kA(s,r),...i?{heliMoves:');
 const signature='regik:(0,eb.regikAurasOn)(e,t,c.tileWorld)}),N=';
 if(!source.includes(signature))throw Error('Kaiser aura tile-signature insertion point changed');
 source=source.replace(signature,'regik:(0,eb.regikAurasOn)(e,t,c.tileWorld),kaiser:kA(t,rG(g,c.sideOf(t.row),w))}),N=');
 const cacheKey='l.dominion,e.slug===t9.IVY?x:"",l.held';
 if(!source.includes(cacheKey))throw Error('Kaiser aura cache-key insertion point changed');
 source=source.replace(cacheKey,'l.dominion,l.kaiser?.domination,l.kaiser?.kaiserGracePct,e.slug===t9.IVY?x:"",l.held');
 }
 if(f===modules.get(49460)){
 const changes=[
 ['wipe:"deepsea"===I,hits:ee','benchmarkDamageScale:p.benchmarkDamageScale,wipe:"deepsea"===I,hits:ee'],
 ['takes:(e,t,l,a,s)=>{if(e.stunShield>0)','takes:(e,t,l,a,s)=>{if(r.benchmarkDamageScale!==undefined&&!(s&tT.HOP))t*=r.benchmarkDamageScale;if(e.stunShield>0)'],
 // Hop overflow is already scaled; scale its added bonus once, not its overflow twice.
 ['hop:(e,t,l)=>(0,tT.hopDamage)(l,','hop:(e,t,l)=>(r.benchmarkDamageScale??1)*(0,tT.hopDamage)(l/(r.benchmarkDamageScale??1),'],
 ['kind:"spawn",frame:e.frame,enemy:t.id,tid:t.tid','kind:"spawn",frame:e.frame,enemy:t.id,tid:t.tid,lane:t.lane,pool:lb(t)'],
 ['ex=t=>{for(let l of','ex=t=>{z&&z({kind:"gone",frame:e.frame,enemy:t.id,pool:lb(t),fate:t.by});for(let l of'],
 ['for(let e=1;e<=_&&(!O||lR.on);e++)e=eB(e);','for(let e=1;e<=_&&(!O||lR.on);e++){e=eB(e);k&&k({kind:"waveStacks",wave:e,frame:es.frame,kits:[...es.kits].map(([key,value])=>({home:Number(String(key).split(":").at(-1)),clara:value.clara?.h,ivy:value.ivy?.s})),stacks:[...es.counts].map(([home,value])=>({home,spotlight:value.spotlight})),omens:Object.entries(es.omens).map(([home,value])=>({home:Number(home),...value}))});}'],
 ['kind:"shot",frame:e.frame,tower:t.key,enemy:l.id','kind:"shot",frame:e.frame,tower:t.key,enemy:l.id,lane:l.lane,stackSnapshot:{clara:t.clara?.h,ivy:t.ivy?.s}'],
 ['kind:"after",frame:e.frame,tower:t.key,fired:l','kind:"after",frame:e.frame,tower:t.key,fired:l,stackSnapshot:{clara:t.clara?.h,ivy:t.ivy?.s}'],
 ['kind:"hit",frame:e.frame,tower:l.key,enemy:t.id,tid:t.tid,dmg:u,dealt:a','kind:"hit",frame:e.frame,tower:l.key,enemy:t.id,tid:t.tid,dmg:u,dealt:a,stackSnapshot:{clara:l.clara?.h,ivy:l.ivy?.s}']
 ];for(const [before,after]of changes){if(!source.includes(before))throw Error('Original stack diagnostic hook changed: '+before);source=source.replace(before,after);}
 }return source;}
const reg=[...modules.entries()].filter(([id])=>cache.has(id)).map(([id,f])=>`${JSON.stringify(id)}:${diagnosticFactory(f,id)}`).join(',\n');
let loader=fs.readFileSync('inspect.cjs','utf8').match(/function load\(id\)\{[\s\S]*?\nif\(require.main/)[0].replace(/\nif\(require.main$/,'');
const kaiserBootstrap=`const raw=load(12640),demon=${JSON.stringify(KAISER.demon)},rawUnit=${JSON.stringify(KAISER.rawUnit)},liberation=${JSON.stringify(KAISER.liberation)},relic=${JSON.stringify(KAISER.relic)},exclusiveRelic=${JSON.stringify(KAISER.exclusiveRelic)};demon.libAtk=l=>500+100*Math.min(10,Math.max(0,Math.round(l)))+150*Math.max(0,Math.round(l)-10);raw.UNITS.kaiser=rawUnit;raw.LIB_ATK.kaiser={base:500,t1:100,t2:150};raw.RELICS.push(relic);const catalog=load(34621);catalog.DEMONS.push(demon);catalog.DEMON_BY_SLUG.set('kaiser',demon);catalog.SUPREME_SLUGS.add('kaiser');catalog.LIBERATION_DATA.kaiser=liberation;load(42389).EXCLUSIVE_RELIC_BY_SLUG.set('kaiser',exclusiveRelic);const board=load(56584);board.UNITS.push({id:'kaiser',name:'Kaiser',rarity:'supreme'});board.UNIT_BY_ID.set('kaiser',board.UNITS.at(-1));`;
fs.writeFileSync(path.join(dist,'engine.js'),`(()=>{const registry={${reg}};const modules=new Map(Object.entries(registry).map(([k,v])=>[+k,v])),cache=new Map(),fncache=new Map();\n${loader}\n${kaiserBootstrap}\nglobalThis.CoopRange=load(5706);globalThis.CoopOmen=load(24012);globalThis.CoopWall=load(90656);globalThis.CoopWallRules=load(16871);globalThis.CoopWallArrival=load(65335);globalThis.CoopEngine=load(98018);globalThis.CoopData=catalog;globalThis.CoopBoss=load(49460);globalThis.CoopBoard=board;globalThis.CoopGeometry=load(21428);globalThis.CoopTargets=load(1503);globalThis.CoopRules=load(9469);globalThis.CoopExtras=load(86245);globalThis.CoopAccount=load(42389);})();`);
const translations=JSON.parse(fs.readFileSync('ko.json','utf8'));
fs.copyFileSync('ko.json',path.join(dist,'ko.json'));
for(const name of fs.readdirSync(path.join(dist,'_next/static/immutable/chunks'))){
 if(!name.endsWith('.js'))continue;
 const p=path.join(dist,'_next/static/immutable/chunks',name),original=fs.readFileSync(p,'utf8');let s=original;
 // Use the original template-tag translator with a Korean lookup before locale fallback.
 // Preserve the original hydration strings. The DOM translator starts after load.
 // The archived standalone edition does not collect original analytics.
 s=s.replace(/navigator\.sendBeacon\("\/api\/log",/g,'(()=>true)("/api/log",');
 if(s!==original)fs.writeFileSync(p,s);
}
for(const route of ['dps-compare','dps-rank','board','boss-sim','charts','tickets','lib-sim','wall-sim']){
 const p=path.join(dist,route,'index.html');let s=fs.readFileSync(p,'utf8');
 s=s.replace('<head>',`<head><script>globalThis.COOP_KO=${JSON.stringify(translations).replace(/</g,'\\u003c')};</script><script src="/localize.js" defer></script>`);
 const temp=p+'.codex-tmp';fs.writeFileSync(temp,s);fs.renameSync(temp,p);
}
fs.copyFileSync('ui/home.html',path.join(dist,'index.html'));
const dealerRankingHash=require('./dealer-revision.cjs')();let dealerRankingCache=null;try{dealerRankingCache=JSON.parse(fs.readFileSync(path.join(dist,'dealer-rankings.json'),'utf8'));}catch{}if(dealerRankingCache?.sourceHash!==dealerRankingHash)require('child_process').execFileSync(process.execPath,['dealer-rankings-build.cjs'],{stdio:'inherit'});for(const [route,source]of [['lab','board'],['stages','stages'],['wall','wall'],['units','units'],['dealer-tiers','dealer-tiers']]){fs.mkdirSync(path.join(dist,route),{recursive:true});fs.copyFileSync('ui/'+source+'.html',path.join(dist,route,'index.html'));}for(const f of ['unit-cache.js','dealer-tools.js','design-system.css','design-shell.js','dashboard.js','compute-pool.js','recovery-tools.js','workspace-shell.js','workspace-shell.css','mobile-board.js','board-convenience.js','board-range-tools.js','unit-position-tools.js','units.css','units-page.js','dealer-tiers.css','dealer-tiers-page.js','unit-worker.js','unit-tools.js','wall-page.js','wall-tools.js','portal.css','portal.js','stages-page.js','stage-tools.js','eggby-tools.js','clara-tools.js','account-ui.js','account.css','pressure-tools.js','rank-ui.js','ranking-page.js','ranking-result.js','rankings.js','rankings.css','responsive.css','gem-tools.js','board-presets.js','board-app.js','board.css','board-worker.js','optimizer-core.js','localize.js','logo.svg'])fs.copyFileSync('ui/'+f,path.join(dist,f));
fs.mkdirSync(path.join(dist,'rankings'),{recursive:true});fs.copyFileSync('ui/ranking.html',path.join(dist,'rankings/index.html'));
const patchNotes=require('./patch-notes.cjs'),patchEntries=JSON.parse(fs.readFileSync('ui/patch-notes.json','utf8'));
const homePath=path.join(dist,'index.html');fs.writeFileSync(homePath,fs.readFileSync(homePath,'utf8').replace('<!--PATCH_NOTES_PREVIEW-->',patchNotes.render(patchEntries,3)));
fs.mkdirSync(path.join(dist,'updates'),{recursive:true});fs.writeFileSync(path.join(dist,'updates/index.html'),fs.readFileSync('ui/updates.html','utf8').replace('<!--PATCH_NOTES_ALL-->',patchNotes.render(patchEntries)));
require('child_process').execFileSync(process.execPath,['unit-cache-build.cjs'],{stdio:'inherit'});
const crypto=require('crypto');const revision=crypto.createHash('sha256').update(fs.readFileSync('ui/wall-tools.js')).update(fs.readFileSync('ui/stage-tools.js')).update(fs.readFileSync('ui/eggby-tools.js')).update(fs.readFileSync('ui/clara-tools.js')).update(fs.readFileSync(path.join(dist,'pressure-tools.js'))).update(fs.readFileSync(path.join(dist,'engine.js'))).update(fs.readFileSync(path.join(dist,'gem-tools.js'))).update(fs.readFileSync(path.join(dist,'board-worker.js'))).update(fs.readFileSync(path.join(dist,'optimizer-core.js'))).digest('hex');fs.writeFileSync(path.join(dist,'cache-version.js'),'self.COOP_DATA_REVISION='+JSON.stringify(revision)+';');fs.writeFileSync(path.join(dist,'dealer-recommendations.js'),'globalThis.CoopDealerRecommendations='+fs.readFileSync(path.join(dist,'dealer-rankings.json'),'utf8')+';');const assetVersion=crypto.createHash('sha256').update(fs.readFileSync('ui/dealer-tools.js')).update(fs.readFileSync('ui/design-system.css')).update(fs.readFileSync('ui/design-shell.js')).update(fs.readFileSync('ui/dashboard.js')).update(revision).update(fs.readFileSync('ui/compute-pool.js')).update(fs.readFileSync('ui/recovery-tools.js')).update(fs.readFileSync('ui/workspace-shell.js')).update(fs.readFileSync('ui/workspace-shell.css')).update(fs.readFileSync('ui/mobile-board.js')).update(fs.readFileSync('ui/board-convenience.js')).update(fs.readFileSync('ui/board-range-tools.js')).update(fs.readFileSync('ui/units.html')).update(fs.readFileSync('ui/units.css')).update(fs.readFileSync('ui/units-page.js')).update(fs.readFileSync('ui/dealer-tiers.html')).update(fs.readFileSync('ui/dealer-tiers.css')).update(fs.readFileSync('ui/dealer-tiers-page.js')).update(fs.readFileSync(path.join(dist,'dealer-rankings.json'))).update(fs.readFileSync('dealer-rankings-build.cjs')).update(fs.readFileSync('ui/unit-worker.js')).update(fs.readFileSync('ui/unit-cache.js')).update(fs.readFileSync('dist/unit-calculation-version.js')).update(fs.readFileSync('ui/unit-tools.js')).update(fs.readFileSync('ui/unit-position-tools.js')).update(fs.readFileSync('ui/wall.html')).update(fs.readFileSync('ui/wall-page.js')).update(fs.readFileSync('ui/home.html')).update(fs.readFileSync('ui/updates.html')).update(fs.readFileSync('ui/patch-notes.json')).update(fs.readFileSync('ui/stages.html')).update(fs.readFileSync('ui/board.html')).update(fs.readFileSync('ui/portal.css')).update(fs.readFileSync('ui/portal.js')).update(fs.readFileSync('ui/stages-page.js')).update(fs.readFileSync('ui/account-ui.js')).update(fs.readFileSync('ui/account.css')).update(fs.readFileSync(path.join(dist,'board-presets.js'))).update(fs.readFileSync(path.join(dist,'board-app.js'))).update(fs.readFileSync(path.join(dist,'index.html'))).update(fs.readFileSync(path.join(dist,'board.css'))).update(fs.readFileSync(path.join(dist,'responsive.css'))).update(fs.readFileSync(path.join(dist,'ko.json'))).update(fs.readFileSync(path.join(dist,'rankings.js'))).update(fs.readFileSync(path.join(dist,'rankings.css'))).update(fs.readFileSync('ui/rank-ui.js')).update(fs.readFileSync('ui/ranking-result.js')).update(fs.readFileSync('ui/ranking-page.js')).update(fs.readFileSync('ui/ranking.html')).digest('hex').slice(0,16);fs.writeFileSync(path.join(dist,'sw.js'),fs.readFileSync('ui/sw.js','utf8').replaceAll('__VERSION__',assetVersion));
for(const entry of ['index.html','lab/index.html','stages/index.html','wall/index.html','units/index.html','dealer-tiers/index.html','rankings/index.html','updates/index.html']){const entryPath=path.join(dist,entry);fs.writeFileSync(entryPath,fs.readFileSync(entryPath,'utf8').replace(/<script src="\/workspace-shell\.js" defer><\/script>/g,'').replace('<head>','<head><link rel="stylesheet" href="/workspace-shell.css"><script src="/dealer-tools.js" defer></script><script src="/dealer-recommendations.js" defer></script><script src="/compute-pool.js" defer></script><script src="/workspace-shell.js" defer></script>').replace('</head>','<link rel="stylesheet" href="/design-system.css"><script src="/design-shell.js" defer></script></head>').replace(/(src|href)="\/(unit-calculation-version\.js|unit-cache\.js|dealer-tools\.js|dealer-recommendations\.js|design-system\.css|design-shell\.js|dashboard\.js|compute-pool\.js|recovery-tools\.js|workspace-shell\.js|workspace-shell\.css|mobile-board\.js|board-convenience\.js|board-range-tools\.js|units\.css|units-page\.js|dealer-tiers\.css|dealer-tiers-page\.js|unit-worker\.js|unit-tools\.js|wall-page\.js|wall-tools\.js|portal\.css|portal\.js|stages-page\.js|stage-tools\.js|eggby-tools\.js|clara-tools\.js|account-ui\.js|account\.css|pressure-tools\.js|rank-ui\.js|ranking-page\.js|ranking-result\.js|rankings\.js|rankings\.css|engine\.js|gem-tools\.js|board-presets\.js|board-app\.js|board\.css|responsive\.css|optimizer-core\.js)"/g,(_,attr,file)=>attr+'="/'+file+'?v='+assetVersion+'"'));}
const summary={files:fs.readdirSync(path.join(dist,'_next/static/immutable/chunks')).length,units:Object.keys(data.UNITS).length,demons:ds.DEMONS.length,gems:ds.GEMS.length};
console.log(JSON.stringify(summary));

// Leaderboard identity changes only for an explicit season; calculation/cache versions remain separate.
const rankingRevision=JSON.parse(fs.readFileSync('ranking-season.json','utf8')).revision;
const calculationRevision=crypto.createHash('sha256').update(revision).update(fs.readFileSync('ui/board-presets.js')).digest('hex').slice(0,24);
const rankingCatalog={revision:rankingRevision,calculationRevision,targets:load(1503).TARGETS.filter(t=>t.type.includes('Boss')).map(t=>({id:t.id,mode:t.mode,name:load(1503).targetName(t).replace(/Final boss/g,'최종 보스').replace(/Colossal Giant/g,'거대 거인').replace(/Boss/g,'보스')}))};
fs.mkdirSync('server',{recursive:true});
fs.writeFileSync('server/ranking-catalog.mjs','export const catalog='+JSON.stringify(rankingCatalog)+';\n');
fs.writeFileSync(path.join(dist,'ranking-catalog.json'),JSON.stringify(rankingCatalog));
fs.writeFileSync(path.join(dist,'_routes.json'),JSON.stringify({version:1,include:['/api/*'],exclude:[]}));

fs.cpSync('ui/assets',path.join(dist,'assets'),{recursive:true});
