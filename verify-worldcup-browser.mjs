import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import './dist/engine.js';
import Worldcup from './ui/worldcup-core.js';
import {accessSettings,saveAccess} from './server/feature-access.mjs';
import {handleTierVotes} from './server/tier-votes.mjs';
import {handleAdmin} from './server/admin.mjs';
import {handleAuth} from './server/accounts.mjs';
import {onRequest as accessMiddleware} from './functions/_middleware.js';
import {onRequest as policyEndpoint} from './functions/api/feature-access.js';
import {onRequest as adminPage} from './functions/admin/[[path]].js';

const sql=new DatabaseSync(':memory:');
sql.exec('CREATE TABLE lab_users(id TEXT PRIMARY KEY,nickname TEXT); CREATE TABLE lab_sessions(token_hash TEXT,csrf TEXT,expires_at INTEGER,user_id TEXT); CREATE TABLE lab_pin_credentials(user_id TEXT,nickname_normalized TEXT UNIQUE);');
const token='a'.repeat(64);
sql.prepare('INSERT INTO lab_users VALUES (?,?)').run('admin','스택');
sql.prepare('INSERT INTO lab_pin_credentials VALUES (?,?)').run('admin','스택');
sql.prepare('INSERT INTO lab_sessions VALUES (?,?,?,?)').run(createHash('sha256').update(token).digest('hex'),'csrf',Date.now()+3600000,'admin');
function prepare(query,values=[]){
 return {bind:(...args)=>prepare(query,args),first:async()=>sql.prepare(query).get(...values)||null,
  all:async()=>({results:sql.prepare(query).all(...values),meta:{changes:0}}),
  run:async()=>/^\s*SELECT\b/i.test(query)?{results:sql.prepare(query).all(...values)}:{meta:sql.prepare(query).run(...values)}};
}
let queue=Promise.resolve();
const env={DB:{prepare,batch(statements){
 const task=queue.then(async()=>{sql.exec('BEGIN');try{const rows=[];for(const statement of statements)rows.push(await statement.run());sql.exec('COMMIT');return rows;}catch(error){sql.exec('ROLLBACK');throw error;}});
 queue=task.catch(()=>{});return task;
}}};
let signedIn=false;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer(async(incoming,outgoing)=>{
 try{
  const url=new URL(incoming.url,'http://'+incoming.headers.host),headers=new Headers(incoming.headers);
  const browserCookies=(headers.get('Cookie')||'').split(';').filter(value=>!value.trim().startsWith('__Host-stack_session=')).filter(Boolean);
  if(signedIn)browserCookies.push('__Host-stack_session='+token);
  if(browserCookies.length)headers.set('Cookie',browserCookies.join('; '));else headers.delete('Cookie');
  const chunks=[];for await(const chunk of incoming)chunks.push(chunk);
  const request=new Request(url,{method:incoming.method,headers,...(['GET','HEAD'].includes(incoming.method)?{}:{body:Buffer.concat(chunks)})});
  const next=async()=>{
   if(url.pathname==='/api/auth/me')return handleAuth({request,env});
   if(url.pathname==='/api/tier-votes')return handleTierVotes({request,env});
   if(url.pathname==='/api/admin')return handleAdmin({request,env});
   if(url.pathname==='/api/feature-access')return policyEndpoint({request,env});
   if(url.pathname.startsWith('/api/'))return Response.json({},{status:503});
   const file=path.resolve('dist','.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));
   const asset=async()=>!file.startsWith(path.resolve('dist')+path.sep)||!fs.existsSync(file)?new Response('',{status:404}):
    new Response(fs.readFileSync(file),{headers:{'Content-Type':types[path.extname(file)]||'application/octet-stream'}});
   return url.pathname.startsWith('/admin/')?adminPage({request,env,next:asset}):asset();
  };
  const response=await accessMiddleware({request,env,next});
  outgoing.writeHead(response.status,Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){outgoing.writeHead(500,{'Content-Type':'application/json'});outgoing.end(JSON.stringify({error:error.message}));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const width of process.env.WORLDCUP_SW_ONLY?[]:[1440,390])for(const kind of ['demons','gems']){
  signedIn=false;
  const context=await browser.newContext({viewport:{width,height:950},hasTouch:width<600,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  const route=kind==='gems'?'/gem-tiers/':'/dealer-tiers/',items=kind==='gems'?CoopData.GEMS.map(g=>g.id):CoopData.demonsIn('supreme').map(d=>d.slug);
  const key='stack-lab-worldcup-v1:admin:'+kind;
  await page.goto(base+route);
  await page.waitForFunction(()=>document.querySelector('#vote-status').textContent.includes('월드컵을 시작'));
  assert.ok(await page.locator('#worldcup-start').isEnabled());
  await page.click('#worldcup-start');
  assert.match(await page.locator('.worldcup-overall-progress').textContent(),/전체 진행률 0%.*최대 \d+회 선택 남음/);
  if(kind==='gems'){
   assert.equal(await page.locator('.worldcup-choice img[src="/assets/gems/stone-sss.webp"]').count(),2);
   for(const card of await page.locator('.worldcup-choice').all()){
    const slug=await card.locator('.worldcup-gem-icon img').last().getAttribute('src');
    const sizes=await card.locator('.worldcup-gem-icon img').evaluateAll(images=>images.map(image=>image.getBoundingClientRect().width));
    assert.ok(Math.abs(sizes[1]/sizes[0]-.78)<.002,'gem glyph remains 78% of its stone at each viewport');
    const effect=await page.evaluate(slug=>CoopGemInfo.effect(CoopData.GEMS.find(g=>slug.endsWith('/'+g.id+'.webp'))),slug);
    assert.equal(await card.locator('.worldcup-gem-effect').textContent(),effect);
    assert.ok(!effect.includes('{'));
   }
  }
  if(kind==='gems')await page.locator('#vote-editor').screenshot({path:process.env.TEMP+'/stack-gem-worldcup-'+width+'.png'});
  await page.locator('.worldcup-choice').first().click();
  assert.equal(await page.evaluate(kind=>JSON.parse(localStorage.getItem('stack-lab-worldcup-v1:guest:'+kind)).picks.length,kind),1);
  signedIn=true;await page.click('#vote-refresh');await page.locator('#worldcup-start:enabled').waitFor();await page.click('#worldcup-start');
  await page.locator('.worldcup-choice').first().click();await page.locator('.worldcup-choice').first().click();
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).picks.length,key),2);
  await page.reload();await page.locator('.worldcup-choice').first().waitFor();
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).picks.length,key),2);
  await page.click('#worldcup-undo');
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).picks.length,key),1);
  let games=0,placement=false;
  while(await page.locator('.worldcup-choice').count()){
   placement ||= (await page.locator('#worldcup-arena h3').textContent()).includes('순위 결정전');
   await page.locator('.worldcup-choice').first().click();
   assert.ok(++games<1000);
  }
  assert.match(await page.locator('.worldcup-overall-progress').textContent(),/전체 진행률 100%.*남은 선택 0회/);
  assert.equal(await page.locator('#worldcup-progress').evaluate(p=>p.value/p.max),1);
  assert.ok(placement);assert.equal(await page.locator('[data-worldcup-final]').count(),items.length);
  const first=await page.locator('[data-worldcup-final]').first().getAttribute('data-worldcup-final');
  const handles=page.locator('.worldcup-drag-handle');
  await page.locator('[data-worldcup-final]').first().evaluate(row=>row.scrollIntoView({block:'center',behavior:'instant'}));
  const a=await handles.nth(0).boundingBox(),b=await handles.nth(1).boundingBox();
  if(width<600){
   const client=await context.newCDPSession(page);
   await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});
   await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});
   await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await client.detach();
  }else{
   await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await page.mouse.up();
  }
  await page.waitForFunction(({key,first})=>JSON.parse(localStorage.getItem(key)).finalRanking?.[1]===first,{key,first});
  await page.reload();await page.locator('[data-worldcup-final]').first().waitFor();
  const final=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).finalRanking,key);
  await page.click('#vote-submit');await page.waitForFunction(()=>document.querySelector('#vote-status').textContent==='월드컵 투표를 반영했습니다.');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);
  const table=kind==='gems'?'gem_tier_votes':'tier_votes',stored=JSON.parse(sql.prepare('SELECT ballot FROM '+table+' WHERE voter=?').get('account:admin').ballot);
  assert.deepEqual(stored.finalRanking,final);
  const result=Worldcup.replay(stored,items);
  assert.equal(result.placements.length,items.length);assert.equal(result.placements.at(-1).points,1);
  assert.equal(sql.prepare('SELECT count(*) AS total FROM '+table).get().total,1);
  await page.click('#vote-image');await page.locator('#vote-export[open]').waitFor();
  assert.ok(await page.locator('#vote-preview').evaluate(image=>image.src.startsWith('blob:')));
  await page.keyboard.press('Escape');
  await page.goto(base+'/admin/');await page.selectOption('#admin-vote-kind',kind);
  await page.getByRole('button',{name:'스택 투표 삭제'}).waitFor();
  await page.getByText('최종 전체 순위 · '+items.length+'개',{exact:true}).click();
  assert.match(await page.locator('#admin-vote-list').textContent(),/최종 확인에서 순위 조정됨/);
  assert.match(await page.locator('#admin-vote-list').textContent(),/위 결정전/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('button',{name:'스택 투표 삭제'}).click();
  await page.waitForFunction(()=>document.querySelector('#admin-vote-status').textContent.includes('총 0표'));
  assert.equal(sql.prepare('SELECT count(*) AS total FROM '+table).get().total,0);
  const voteLabel=(kind==='gems'?'보석':'초마신')+' 월드컵 참여·제출 비로그인 허용';
  const guestRule=page.getByRole('checkbox',{name:voteLabel,exact:true});
  await guestRule.waitFor();await guestRule.uncheck();
  await page.getByRole('checkbox',{name:'다음 성장 추천 비로그인 허용',exact:true}).uncheck();
  await page.click('#admin-feature-save');
  await page.waitForFunction(()=>document.querySelector('#admin-feature-status').textContent==='기능별 접근 조건을 저장했습니다.');
  signedIn=false;await page.goto(base+route);
  await page.waitForFunction(()=>document.querySelector('#vote-status').textContent.includes('로그인 후'));
  assert.ok(await page.locator('#worldcup-start').isDisabled());
  assert.ok(await page.locator('.worldcup-choice').first().isDisabled());
  const blocked=await page.goto(base+'/growth/');
  assert.equal(blocked.status(),401);
  signedIn=true;await page.goto(base+'/admin/');
  await page.getByRole('checkbox',{name:voteLabel,exact:true}).check();
  await page.getByRole('checkbox',{name:'다음 성장 추천 비로그인 허용',exact:true}).check();
  await page.click('#admin-feature-save');
  await page.waitForFunction(()=>document.querySelector('#admin-feature-status').textContent==='기능별 접근 조건을 저장했습니다.');

  assert.deepEqual(errors,[]);await context.close();
  console.log('Worldcup browser passed',width,kind,'draft resume, full ranks, pointer/touch ordering, server scores, PNG, admin deletion and saved access rules');
 }
 signedIn=false;
 const rules=await accessSettings(env.DB);
 await saveAccess(env.DB,{...rules,features:rules.features.map(feature=>({...feature,guest:feature.id==='growth'?false:feature.guest}))});
 const offline=await browser.newContext({serviceWorkers:'allow'}),offlinePage=await offline.newPage();
 await offlinePage.goto(base+'/');
 await offlinePage.waitForFunction(async()=>{const registrations=await navigator.serviceWorker.getRegistrations();return registrations.some(registration=>registration.active?.state==='activated');},null,{timeout:30000});
 const cachedGrowth=await offlinePage.evaluate(async url=>!!await caches.match(url),base+'/growth/');
 assert.equal(cachedGrowth,false,'role-restricted pages are not stored in the offline shell');
 await offline.close();
 console.log('Service worker installs with restricted pages and omits protected HTML.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
