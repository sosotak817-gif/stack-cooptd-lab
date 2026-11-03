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
  await page.goto(base+'/stages/');await page.waitForSelector('#start-stages:enabled');
  for(const mode of ['abyss','deepsea'])await page.locator('[name=stage-mode][value='+mode+']').uncheck();
  await page.click('#start-stages');await page.waitForFunction(()=>document.querySelector('#stage-status').textContent.includes('분석 완료'),{timeout:120000});
  assert.equal(await page.locator('.stage-report-picker button').count(),4);assert.equal(await page.locator('.stage-report:visible').count(),1);
  const panel=()=>page.locator('.stage-report:visible');assert.ok(await panel().locator('[data-stage-view=overview]').isVisible());assert.ok(await panel().locator('.stage-damage-dashboard').isHidden());
  const capacity=panel().locator('.stage-summary-grid > div').first();
  assert.match(await capacity.textContent(),/^내 덱 독립 인분/);
  assert.match(await capacity.locator('strong').textContent(),/인분|산출 불가/);
  const failed=page.locator('.stage-report[data-outcome$="첫 실패"]').first();
  assert.ok(await failed.count(),'fixture must exercise failed stage results');
  const failedKey=await failed.getAttribute('data-report-key');
  await page.locator('.stage-report-picker button[data-report-key="'+failedKey+'"]').click();
  const growth=panel().locator('[data-stage-growth]');
  await growth.getByRole('heading',{name:'성장 추천'}).waitFor();
  await page.waitForFunction(()=>/첫 실패 지연이 확인된 성장 후보가 없습니다|각 후보를 현재 덱에 하나씩/.test(document.querySelector('.stage-report:not([hidden]) [data-stage-growth]')?.textContent||''),null,{timeout:120000});
  await page.locator('.stage-report-picker button').first().click();
  const originalRows=await panel().locator('.stage-share-bar').count();assert.ok(originalRows>0);
  await panel().getByRole('button',{name:'유닛 딜량',exact:true}).click();assert.ok(await panel().locator('.stage-damage-dashboard').isVisible());assert.ok(await panel().locator('[data-stage-view=overview]').isHidden());
  await panel().getByRole('button',{name:'라운드 흐름',exact:true}).click();assert.ok(await panel().locator('.stage-share-chart').isVisible());await panel().locator('.stage-share-bar').first().click();assert.ok(await panel().locator('.stage-damage-dashboard').isVisible());assert.match(await panel().locator('.stage-unit-scope').textContent(),/1R/);
  await page.locator('.stage-report-picker button').nth(2).click();assert.equal(await page.locator('.stage-report:visible').count(),1);assert.ok(await panel().locator('[data-stage-view=overview]').isVisible());
  await page.locator('#stage-damage-links button').first().click();assert.ok(await panel().locator('.stage-damage-dashboard').isVisible(),'shortcut reveals report and unit tab');
  for(const width of [1440,393]){await page.setViewportSize({width,height:900});await panel().getByRole('button',{name:'결과 요약',exact:true}).click();await page.locator('.stage-report-picker').evaluate(e=>e.scrollIntoView({block:'start'}));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'stage-summary-'+width+'.png')});const height=await page.locator('#stage-results').evaluate(e=>e.getBoundingClientRect().height);assert.ok(height<1800,'compact summary height '+height);console.log('Stage summary height',width,height);await panel().getByRole('button',{name:'유닛 딜량',exact:true}).click();await page.screenshot({path:path.join(output,'stage-units-'+width+'.png')});}
  assert.equal(await page.evaluate(()=>localStorage.getItem('coop-lab-board-v2')),JSON.stringify(deck));assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('Stage result UI: real two-mode altar comparison, one selected report, summary/unit/round tabs, round drilldown, shortcuts, preserved saved deck and desktop/mobile layout passed.');
 }finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
