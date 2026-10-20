const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
// Isolated DOM/event model: verify choices and sessions without real credentials.
async function mount({mode=null,user=null,ready=true,unavailable=false,url='https://lab.example/',remoteBoard=null}={}){
 const elements=new Map(),storage=new Map(mode?[['stack-lab-access-v1',mode]]:[]),calls=[],actions=[];
 class Element{
  constructor(id){this.id=id;this.open=false;this.disabled=false;this.hidden=false;this.handlers={};elements.set(id,this);}
  set innerHTML(html){this.html=html;for(const match of html.matchAll(/id="([^"]+)"/g))new Element(match[1]);}
  append(){}prepend(child){elements.set('chip',child);}showModal(){this.open=true;}close(){this.open=false;}addEventListener(type,fn){this.handlers[type]=fn;}
 }
 new Element('.top-actions');
 const sample={version:2,cells:[],mode:'hell',you:{perDemon:{}},partner:{perDemon:{}}};
 const context={console,URL,AbortSignal,structuredClone,Date,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{querySelector:s=>elements.get(s.startsWith('#')?s.slice(1):s),createElement:()=>new Element('generated-'+elements.size),body:{append:element=>elements.set(element.id,element)}},history:{replaceState:()=>{}},location:{href:url,assign:target=>actions.push(target)},fetch:async(path,options)=>{
  calls.push({path,options});if(unavailable)throw Error('offline');
  if(path==='/api/auth/session')return Response.json({ready,user,csrf:user?'test-csrf':null});
  if(path==='/api/auth/logout')return Response.json({ok:true});
  if(path==='/api/account/board')return Response.json({board:remoteBoard,revision:0,updatedAt:null});
  throw Error('unexpected path '+path);
 }};context.window=context;context.StackLabAccount={ready:Promise.resolve(),snapshot:()=>structuredClone(sample),load:s=>actions.push(s)};
 vm.createContext(context);vm.runInContext(fs.readFileSync('ui/account-ui.js','utf8'),context);for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));
 return {elements,storage,calls,actions,context,click:async id=>{await elements.get(id).onclick();for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));}};
}
(async()=>{
 const first=await mount();assert.equal(first.elements.get('access-dialog').open,true);assert.equal(first.elements.get('chip').textContent,'비로그인 · 로그인');await first.click('access-guest');assert.equal(first.elements.get('access-dialog').open,false);assert.equal(first.storage.get('stack-lab-access-v1'),'guest');
 const guest=await mount({mode:'guest'});assert.equal(guest.elements.get('access-dialog').open,false);await guest.click('chip');assert.equal(guest.elements.get('access-dialog').open,true);await guest.click('access-naver');assert.deepEqual(guest.actions,['/api/auth/naver']);
 const logged=await mount({mode:'account',user:{id:'one',nickname:'연구원'}});assert.equal(logged.elements.get('access-dialog').open,false);assert.equal(logged.elements.get('chip').textContent,'계정 · 연구원');await logged.click('chip');assert.equal(logged.elements.get('account-dialog').open,true);await logged.click('account-logout');assert.equal(logged.storage.get('stack-lab-access-v1'),'guest');assert.equal(logged.elements.get('chip').textContent,'비로그인 · 로그인');assert.equal(logged.calls.at(-1).options.headers['X-CSRF-Token'],'test-csrf');
 const expired=await mount({mode:'account'});assert.equal(expired.elements.get('access-dialog').open,true);
 const missing=await mount({ready:false});await missing.click('access-naver');assert.equal(missing.actions.length,0);assert.match(missing.elements.get('access-status').textContent,/준비되지/);await missing.click('access-guest');assert.equal(missing.storage.get('stack-lab-access-v1'),'guest');
 const offline=await mount({unavailable:true});await offline.click('access-guest');assert.equal(offline.elements.get('access-dialog').open,false);
 const returned=await mount({user:{id:'one',nickname:'연구원'},url:'https://lab.example/?login=success'});assert.equal(returned.elements.get('account-sync-dialog').open,true);assert.equal(returned.elements.get('sync-upload').disabled,false);assert.equal(returned.elements.get('sync-download').disabled,true);assert.equal(returned.calls.filter(c=>c.options.method==='PUT').length,0,'login never silently uploads local data');
 const cancelled=await mount({mode:'guest',url:'https://lab.example/?login_error=cancelled'});assert.equal(cancelled.elements.get('access-dialog').open,true);assert.match(cancelled.elements.get('access-status').textContent,/취소/);
 console.log('Account UI: first visit, remembered guest, guest-to-login, restored/expired session, logout, unavailable/offline fallback and explicit cloud import selection passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
