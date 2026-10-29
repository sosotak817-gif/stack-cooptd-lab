// Optional real-browser audit: requires Playwright and an installed Edge browser.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const output=process.env.LAB_AUDIT_OUTPUT||path.join(process.cwd(),'.openai','browser-audit');
async function main(){
 fs.mkdirSync(output,{recursive:true});
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local');if(url.pathname.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Offline audit: API unavailable'}));}let relative=decodeURIComponent(url.pathname);if(relative.endsWith('/'))relative+='index.html';const file=path.resolve('dist','.'+relative);if(!file.startsWith(path.resolve('dist')+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'}),context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[],missing=[],reports=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()===404&&!response.url().includes('/api/'))missing.push(new URL(response.url()).pathname);});
 async function contrast(){return page.evaluate(()=>{
  const rgb=s=>s.match(/[\d.]+/g)?.map(Number),lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0),rows=[];
  for(const e of document.querySelectorAll('main *,dialog[open] *')){if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())||!e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})||e.closest('button:disabled,[hidden],svg,.unit-position-map,.wall-board,.board'))continue;
   const s=getComputedStyle(e);if(Number(s.opacity)<.9)continue;let bg=[10,18,30],gradient=false;for(let p=e;p;p=p.parentElement){const ps=getComputedStyle(p);if(ps.backgroundImage!=='none'){gradient=true;break;}const c=rgb(ps.backgroundColor);if(c&&(c.length<4||c[3]>.95)){bg=c;break;}}if(gradient)continue;const fg=rgb(s.color);if(!fg||fg[3]===0)continue;const ratio=(Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05),limit=parseFloat(s.fontSize)>=24||parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700?3:4.5;if(ratio<limit)rows.push({selector:e.tagName.toLowerCase()+(e.id?'#'+e.id:'.'+String(e.className).split(' ').join('.')),text:e.textContent.trim().slice(0,65),ratio:Number(ratio.toFixed(2)),color:s.color,bg:JSON.stringify(bg)});
  }return rows.slice(0,60);
 });}
 try{
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});for(const route of ['/','/lab/','/units/','/dealer-tiers/','/stages/','/wall/','/rankings/','/updates/']){
   await page.goto(base+route,{waitUntil:'load'});await page.waitForFunction(()=>document.documentElement.classList.contains('lab-dark'));await page.waitForTimeout(700);
   if(route==='/'){assert.ok(await page.locator('#dashboard-tiers').textContent());await page.click('#visitor-open');assert.ok(await page.locator('#visitor-dialog').evaluate(e=>e.open));await page.keyboard.press('Escape');}
   if(route==='/lab/'){if(width<600)await page.locator('.mobile-launcher').getByRole('button',{name:'초마신',exact:true}).click();else await page.click('#open-unit');await page.waitForSelector('dialog[open]');await page.keyboard.press('Escape');}
   if(route==='/units/'){
    await page.waitForFunction(()=>document.querySelectorAll('#unit-top-list li').length===5,{timeout:30000});assert.match(await page.textContent('#unit-top-status'),/저장|사전 계산|DB/);
    await page.waitForFunction(()=>document.querySelector('#unit-status').textContent.includes('계산 완료'),{timeout:30000});
    await page.locator('#unit-position-cancel').click({timeout:1000}).catch(()=>{});
    const first=page.locator('#unit-top-list .unit-top-value').first(),before=await first.textContent();await first.click();assert.notEqual(await first.textContent(),before);
    await page.locator('#unit-top-list li').first().locator('button').last().click();await page.waitForTimeout(700);
    await page.locator('#unit-gem-comparison').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'units-'+width+'.png')});
    const saved=await page.textContent('#unit-top-status');await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#unit-top-list li').length===5);assert.match(await page.textContent('#unit-top-status'),/기기 저장/);console.log('Stored-first reload:',width,saved);
   }
   if(route==='/dealer-tiers/'){assert.ok(await page.locator('#vote-editor').isHidden());assert.equal(await page.locator('#vote-results').count(),0);await page.click('#vote-open');await page.waitForSelector('#vote-choices button');assert.equal(await page.locator('#vote-choices button').count(),7);await page.locator('#vote-candidates button').first().click();assert.equal(await page.locator('#vote-choices img').count(),1);assert.ok(await page.locator('#vote-submit').isDisabled());await page.click('#vote-close');await page.locator('a[href="/dealer-tiers/create/"]').click();await page.waitForSelector('#personal-tier-board [data-personal-slug]');assert.equal(await page.locator('#tier-ballot').count(),0);}
   if(route==='/updates/'){await page.locator('.patch-note summary').first().click();assert.ok(await page.locator('.patch-note').first().evaluate(e=>e.open));}
   const lowContrast=await contrast();reports.push({route,width,lowContrast});await page.screenshot({path:path.join(output,route==='/'?'home-'+width+'.png':route.replaceAll('/','')+'-'+width+'.png')});console.log('Browser audit:',route,width,'low-contrast candidates:',lowContrast.length);
  }}
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({errors,missing:[...new Set(missing)],reports},null,2));assert.deepEqual(errors,[],'no uncaught page errors');assert.deepEqual([...new Set(missing)],[],'no missing local assets');assert.deepEqual(reports.flatMap(r=>r.lowContrast),[],'visible flat-background text meets the contrast threshold');
 }finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
