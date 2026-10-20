const fs=require('fs'),path=require('path');
const {load,modules,cache}=require('./inspect.cjs');
const root='.',dist=path.join(root,'dist');fs.mkdirSync(dist,{recursive:true});
fs.cpSync(path.join(root,'original'),dist,{recursive:true});
const engine=load(98018),data=load(12640),ds=load(34621),extras=load(86245);
load(49460);load(56584);load(21428);load(1503);load(9469);
const plain={source:'https://coop-tools.vercel.app/',collectedAt:new Date().toISOString(),scope:'Public browser-delivered data and JavaScript; not the private source repository or server code.',...data,demons:ds.DEMONS,gems:ds.GEMS,liberation:ds.LIBERATION_DATA,defaults:engine.DEFAULT_PARAMS,traits:extras.TRAITS};
fs.writeFileSync(path.join(root,'data.json'),JSON.stringify(plain,null,2));fs.copyFileSync(path.join(root,'data.json'),path.join(dist,'data.json'));
for(const d of ds.DEMONS)engine.computeDemon(d,structuredClone(engine.DEFAULT_PARAMS));
const reg=[...modules.entries()].filter(([id])=>cache.has(id)).map(([id,f])=>`${JSON.stringify(id)}:${f.toString()}`).join(',\n');
let loader=fs.readFileSync('inspect.cjs','utf8').match(/function load\(id\)\{[\s\S]*?\nif\(require.main/)[0].replace(/\nif\(require.main$/,'');
fs.writeFileSync(path.join(dist,'engine.js'),`(()=>{const registry={${reg}};const modules=new Map(Object.entries(registry).map(([k,v])=>[+k,v])),cache=new Map(),fncache=new Map();\n${loader}\nglobalThis.CoopEngine=load(98018);globalThis.CoopData=load(34621);globalThis.CoopBoss=load(49460);globalThis.CoopBoard=load(56584);globalThis.CoopGeometry=load(21428);globalThis.CoopTargets=load(1503);globalThis.CoopRules=load(9469);globalThis.CoopExtras=load(86245);})();`);
const translations=JSON.parse(fs.readFileSync('ko.json','utf8'));
fs.copyFileSync('ko.json',path.join(dist,'ko.json'));
for(const name of fs.readdirSync(path.join(dist,'_next/static/immutable/chunks'))){
 if(!name.endsWith('.js'))continue;
 const p=path.join(dist,'_next/static/immutable/chunks',name);let s=fs.readFileSync(p,'utf8');
 // Use the original template-tag translator with a Korean lookup before locale fallback.
 // Preserve the original hydration strings. The DOM translator starts after load.
 // The archived standalone edition does not collect original analytics.
 s=s.replace(/navigator\.sendBeacon\("\/api\/log",/g,'(()=>true)("/api/log",');
 fs.writeFileSync(p,s);
}
for(const route of ['dps-compare','dps-rank','board','boss-sim','charts','tickets','lib-sim','wall-sim']){
 const p=path.join(dist,route,'index.html');let s=fs.readFileSync(p,'utf8');
 s=s.replace('<head>',`<head><script>globalThis.COOP_KO=${JSON.stringify(translations).replace(/</g,'\\u003c')};</script><script src="/localize.js" defer></script>`);
 fs.writeFileSync(p,s);
}
fs.copyFileSync('ui/board.html',path.join(dist,'index.html'));for(const f of ['board-presets.js','board-app.js','board.css','board-worker.js','optimizer-core.js','localize.js','logo.svg'])fs.copyFileSync('ui/'+f,path.join(dist,f));
const crypto=require('crypto');const revision=crypto.createHash('sha256').update(fs.readFileSync(path.join(dist,'engine.js'))).update(fs.readFileSync(path.join(dist,'board-worker.js'))).update(fs.readFileSync(path.join(dist,'optimizer-core.js'))).digest('hex');fs.writeFileSync(path.join(dist,'cache-version.js'),'self.COOP_DATA_REVISION='+JSON.stringify(revision)+';');const assetVersion=crypto.createHash('sha256').update(revision).update(fs.readFileSync(path.join(dist,'board-presets.js'))).update(fs.readFileSync(path.join(dist,'board-app.js'))).update(fs.readFileSync(path.join(dist,'index.html'))).update(fs.readFileSync(path.join(dist,'board.css'))).update(fs.readFileSync(path.join(dist,'ko.json'))).digest('hex').slice(0,16);fs.writeFileSync(path.join(dist,'sw.js'),fs.readFileSync('ui/sw.js','utf8').replace('__VERSION__',assetVersion));
const summary={files:fs.readdirSync(path.join(dist,'_next/static/immutable/chunks')).length,units:Object.keys(data.UNITS).length,demons:ds.DEMONS.length,gems:ds.GEMS.length};
console.log(JSON.stringify(summary));
