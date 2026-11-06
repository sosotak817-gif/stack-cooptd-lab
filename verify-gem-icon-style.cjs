const assert=require('node:assert/strict'),fs=require('fs'),http=require('http'),path=require('path'),{chromium}=require('playwright');
require('./dist/engine.js');
(async()=>{
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://local');
  if(url.pathname.startsWith('/api/')){
   res.setHeader('Content-Type','application/json');
   return res.end(JSON.stringify(url.pathname==='/api/tier-votes'?{total:1,mine:null,canVote:true,rows:CoopData.GEMS.map((g,i)=>({slug:g.id,tier:i<4?'S':'A',score:45-i,votes:1}))}:{}));
  }
  const file=path.join('dist',url.pathname,url.pathname.endsWith('/')?'index.html':'');
  try{res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const width of [1440,390])for(const personal of [false,true]){
   const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/gem-tiers/'+(personal?'create/':''));
   const prefix=personal?'personal-tier':'vote',button=personal?'personal-tier-image':'vote-image';
   await page.locator('#'+button+':enabled').waitFor();
   await page.locator('.dealer-tier-card .worldcup-gem-icon').first().waitFor();
   assert.equal(await page.locator('#gem-icon-style').inputValue(),'gem');
   await page.selectOption('#gem-icon-style','white');
   assert.equal(await page.locator('.worldcup-gem-icon img').first().evaluate(i=>getComputedStyle(i).visibility),'hidden');
   await page.reload();
   await page.locator('#'+button+':enabled').waitFor();
   assert.equal(await page.locator('#gem-icon-style').inputValue(),'white');
   await page.click('#'+button);
   const preview=page.locator('#'+prefix+'-preview');
   await page.locator('#'+prefix+'-export[open]').waitFor();
   const whiteURL=await preview.getAttribute('src');
   const whitePNG=await preview.evaluate(async i=>Array.from(new Uint8Array(await(await fetch(i.src)).arrayBuffer())));
   await page.selectOption('#gem-export-icon-style','gem');
   await page.waitForFunction(({id,old})=>document.getElementById(id).src!==old,{id:prefix+'-preview',old:whiteURL});
   await page.locator('#gem-export-icon-style:enabled').waitFor();
   const gemPNG=await preview.evaluate(async i=>Array.from(new Uint8Array(await(await fetch(i.src)).arrayBuffer())));
   assert.notDeepEqual(whitePNG,gemPNG,'the exported pixels must change with icon style');
   assert.equal(await page.locator('#gem-icon-style').inputValue(),'gem');
   assert.equal(await page.locator('.worldcup-gem-icon img').first().evaluate(i=>getComputedStyle(i).visibility),'visible');
   const alpha=await page.evaluate(async()=>{const [gem,white]=await Promise.all([CoopGemTierIcons.load('battle','gem'),CoopGemTierIcons.load('battle','white')]);return [gem,white].map(c=>{const pixels=c.getContext('2d').getImageData(0,0,128,128).data;let n=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0)n++;return n;});});
   assert.ok(alpha[0]>alpha[1],'gem export includes the stone around the white glyph');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.locator('#'+prefix+'-export').screenshot({path:process.env.TEMP+'/gem-icon-style-'+(personal?'personal':'community')+'-'+width+'.png'});
   assert.deepEqual(errors,[]);
   await context.close();console.log('Gem icon choices passed',width,personal?'personal':'community','screen, persistence, regenerated PNG and stone pixels');
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
