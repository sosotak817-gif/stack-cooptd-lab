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
  for(const width of [360,393,430]){
   await page.setViewportSize({width,height:780});await page.goto(base+'/research/?tool=board');
   const board=page.frameLocator('[data-research-tool="board"]');await board.locator('body.mobile-board.research-focus').waitFor();
   await board.locator('.mobile-launcher').waitFor();await page.waitForTimeout(500);
   assert.equal(await page.locator('.lab-sidebar nav').isVisible(),false);
   await page.locator('.lab-mobile-menu').click();assert.ok(await page.locator('.lab-sidebar nav').isVisible());await page.keyboard.press('Escape');assert.ok(await page.locator('.lab-sidebar nav').isHidden());
   assert.ok(await board.locator('#mobile-account-dialog .partner-panel').count(),'partner stays in mobile popup');
   assert.ok(await board.locator('.field-controls').isHidden(),'duplicated field controls hidden');
   const geometry=await page.evaluate(()=>{const f=document.querySelector('[data-research-tool="board"]'),b=f.contentDocument.querySelector('#board');return {top:f.getBoundingClientRect().top+b.getBoundingClientRect().top,width:b.getBoundingClientRect().width,outer:document.documentElement.scrollWidth-innerWidth};});
   assert.ok(geometry.top<530,'board reachable in initial viewport: '+JSON.stringify(geometry));assert.ok(geometry.width>=width-70,'board uses mobile width');assert.ok(geometry.outer<=1);
   await page.screenshot({path:path.join(output,'mobile-research-board-'+width+'.png')});
   await board.getByRole('button',{name:'상세 결과',exact:true}).click();assert.ok(await board.locator('#mobile-result-dialog').evaluate(e=>e.open));await board.locator('#mobile-result-dialog .dialog-top button').click();
   await board.getByRole('button',{name:'프리셋',exact:true}).click();assert.ok(await board.locator('#mobile-preset-dialog').evaluate(e=>e.open));await board.locator('#mobile-preset-dialog .dialog-top button').click();
   await board.locator('.mobile-launcher').getByRole('button',{name:'유닛 추가',exact:true}).click();assert.ok(await board.locator('#mobile-roster-dialog').evaluate(e=>e.open));await board.locator('#mobile-roster-dialog .dialog-top button').click();
   assert.equal(await page.locator('.research-tools').evaluate(e=>getComputedStyle(e).position),'static');const before=await page.locator('.research-tools').evaluate(e=>e.getBoundingClientRect().top);await page.evaluate(()=>scrollTo(0,120));const after=await page.locator('.research-tools').evaluate(e=>e.getBoundingClientRect().top);assert.ok(after<before-20,'tools scroll with the page');await page.evaluate(()=>scrollTo(0,0));console.log('Mobile board',width,geometry);
  }
  await page.setViewportSize({width:393,height:780});await page.goto(base+'/');await page.locator('.research-tool-tile').click();await page.waitForURL(base+'/research/');const workspace=page;await workspace.getByRole('tab',{name:'배치 편집',exact:true}).click();const nested=workspace.frameLocator('[data-research-tool="board"]');await nested.locator('.mobile-launcher').waitFor();assert.ok(await nested.locator('#mobile-account-dialog .partner-panel').count());await nested.getByRole('button',{name:'상세 결과',exact:true}).click();assert.ok(await nested.locator('#mobile-result-dialog').evaluate(e=>e.open));
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('Mobile research: board visible above fold, usable full-width board, compact accessible menu, mobile-only controls, result/preset/roster dialogs at 360/393/430 widths passed.');
 }finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
