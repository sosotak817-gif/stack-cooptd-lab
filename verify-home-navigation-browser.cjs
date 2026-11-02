// Optional integration audit: npm install --no-save --package-lock=false playwright
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
require('./dist/engine.js');require('./ui/board-presets.js');const J=require('./ui/journey-core.js');
const deck={version:2,unitDefaultsVersion:1,mode:'hard',target:CoopTargets.finalBossOf('hard').id,partnerEnabled:false,cells:[{row:6,col:3,slug:'clara',lib:false,nolib:true}],marks:[],you:CoopPresets.newAccount(CoopEngine,CoopData),partner:CoopPresets.newAccount(CoopEngine,CoopData)};
deck.you.perDemon.clara={level:11,lib:0,skinLevels:0,gems:[{id:'strikes',grade:'S'}],installWave:1};deck.you.claraInput='manual';deck.you.claraStacks=100;deck.you.installWave=1;
const output=path.join('.openai','browser-audit','journey');fs.mkdirSync(output,{recursive:true});
async function main(){
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local');if(url.pathname.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json'});return res.end('{}');}const file=path.resolve('dist','.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));if(!file.startsWith(path.resolve('dist')+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:960},acceptDownloads:true}),page=await context.newPage(),errors=[],missing=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()===404&&!response.url().includes('/api/'))missing.push(response.url());});


 try{
  for(const width of [1440,393]){
   await page.setViewportSize({width,height:900});
   for(const [selector,route]of [['.dashboard-tools a[href="/lab/"]','lab'],['.dashboard-tools a[href="/units/"]','units'],['.dashboard-tools a[href="/stages/"]','stages'],['.dashboard-tools a[href="/wall/"]','wall'],['.home-journey a[href="/growth/"]','growth'],['.home-journey a[href="/diagnosis/"]','diagnosis'],['.home-journey a[href="/decks/"]','decks'],['.research-tool-tile','research']]){
    await page.goto(base+'/');await page.evaluate(()=>window.homeDocumentMarker=true);
    assert.equal(await page.locator('.research-tool-tile img').count(),1);
    await page.locator(selector).click();await page.waitForURL(base+'/'+route+'/');
    assert.equal(await page.evaluate(()=>window.homeDocumentMarker),undefined,'full page navigation to '+route);
    assert.equal(await page.locator('iframe.workspace-frame').count(),0,'no wrapping workspace for '+route);
   }
   await page.goto(base+'/');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'home-direct-navigation-'+width+'.png'),fullPage:true});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('Home navigation: eight destinations use full page navigation, separate integrated research icon, desktop/mobile fit, no errors or missing assets.');
 }finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
