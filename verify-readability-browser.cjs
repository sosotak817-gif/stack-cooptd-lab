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
  await page.addInitScript(value=>localStorage.setItem('coop-lab-board-v2',JSON.stringify(value)),deck);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:960});await page.goto(base+'/lab/');
   await page.waitForFunction(()=>document.querySelectorAll('.contribution-share').length>0);
   for(const cls of ['deck-dps-range','damage-results']){
    const panel=page.locator('details.'+cls);assert.equal(await panel.evaluate(e=>e.open),false,'details closed by default');
   }
   const dps=page.locator('#actual-dps');assert.ok(await dps.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>=32);
   const before=await dps.textContent();await dps.click();assert.notEqual(await dps.textContent(),before,'precision toggle preserved');
   if(width<600){await page.locator('.mobile-launcher').getByRole('button',{name:'더보기',exact:true}).click();await page.getByRole('button',{name:'상세 DPS·피해량',exact:true}).click();}
   for(const cls of ['deck-dps-range','damage-results']){const panel=page.locator('details.'+cls);await panel.locator('summary').click();assert.ok(await panel.evaluate(e=>e.open));await panel.locator('summary').click();}
   const shares=await page.locator('.contribution-share').allTextContents();assert.deepEqual(shares,['100.0%']);
   await page.screenshot({path:path.join(output,'readability-board-'+width+'.png'),fullPage:true});
   for(const route of ['','lab','units','dealer-tiers','dealer-tiers/create','stages','wall','rankings','updates','growth','diagnosis','guide','decks','research']){
    await page.goto(base+'/'+(route?route+'/':''));await page.waitForTimeout(250);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' fits '+width);
   }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('Readability: large actual DPS, precision toggle, native closed details, contribution shares, all 14 routes fit desktop/mobile; no page errors or missing assets.');
 }finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
