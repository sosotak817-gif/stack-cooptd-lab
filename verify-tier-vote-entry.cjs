const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),W=require('./ui/worldcup-core');
require('./dist/engine.js');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.hidden=false;this.dataset={};this.attrs={};this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(key,value){this.attrs[key]=value;}
 querySelector(tag){return this.children.find(node=>node.tag===tag)||this.children.map(node=>node.querySelector?.(tag)).find(Boolean)||null;}
 showModal(){this.open=true;}close(){this.open=false;}focus(){}
}
(async()=>{
 const {tally}=await import('./server/tier-votes.mjs');
 for(const gemMode of [false,true])for(const accountMode of [false,true]){
  const roster=gemMode?CoopData.GEMS.map(g=>g.id):CoopData.demonsIn('supreme').map(d=>d.slug),storage=new Map();
  let signedIn=false,submitted=null,fail=false,shared=false;
  async function mount(){
   const nodes=new Map(),get=selector=>{
    if(selector==='#worldcup-arena h3')return get('#worldcup-arena').querySelector('h3');
    if(!nodes.has(selector))nodes.set(selector,new Element('div'));
    return nodes.get(selector);
   };
   const context={CoopGemInfo:{effect:()=>'SSS 효과'},CoopData,CoopWorldcup:W,console,structuredClone,URLSearchParams,File,Blob,Intl,confirm:()=>true,
    window:{addEventListener(){}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    document:{body:{dataset:{tierKind:gemMode?'gems':'demons'}},fonts:{ready:Promise.resolve()},querySelector:get,
     createElement:tag=>{const node=new Element(tag);if(tag==='canvas'){node.getContext=()=>new Proxy({},{get:()=>()=>{}});node.toBlob=fn=>fn(new Blob(['png'],{type:'image/png'}));}return node;}},
    Image:class{constructor(){this.width=this.height=64;}set src(value){this.onload();}},
    URL:{createObjectURL:()=> 'blob:worldcup',revokeObjectURL(){}},
    navigator:{canShare:()=>true,share:async()=>{shared=true;}},
    fetch:async(url,options)=>{
     if(url==='/ko.json')return {ok:true,json:async()=>({})};
     if(url==='/api/auth/me')return {ok:true,json:async()=>({user:signedIn?{id:'tester'}:null,csrf:'csrf'})};
     if(options?.method==='PUT'){
      if(fail)return {ok:false,json:async()=>({error:'저장 실패'})};
      submitted=JSON.parse(options.body).ballot;
      assert.ok(W.replay(submitted,roster).complete);
     }
     return {ok:true,json:async()=>({mine:submitted,total:submitted?1:0,rows:tally(submitted?[submitted]:[],roster)})};
    }};
   vm.runInNewContext(fs.readFileSync('ui/dealer-tiers-page.js','utf8'),context);
   await new Promise(setImmediate);
   return get;
  }
  let get=await mount();
  assert.equal(get('#worldcup-start').disabled,false);
  signedIn=accountMode;await get('#vote-refresh').onclick();
  get('#worldcup-start').onclick();
  const key='stack-lab-worldcup-v1:'+(accountMode?'tester':'guest')+':'+(gemMode?'gems':'demons');
  const choose=()=>get('#worldcup-arena').children.find(node=>node.className==='worldcup-choices').children[0].onclick();
  choose();choose();
  assert.equal(JSON.parse(storage.get(key)).picks.length,2);
  get=await mount();
  assert.match(get('#vote-status').textContent,/이어서/);
  get('#worldcup-undo').onclick();assert.equal(JSON.parse(storage.get(key)).picks.length,1);
  let guard=0;
  while(get('#vote-submit').hidden){choose();assert.ok(++guard<1000);}
  assert.ok(JSON.parse(storage.get(key)).picks.length>roster.length-1,'additional placement games are required');
  const before=W.replay(JSON.parse(storage.get(key)),roster).finalRanking;
  const list=get('#worldcup-arena').children.find(node=>node.className==='worldcup-final-list');
  list.children.at(-1).ondrop({preventDefault(){},dataTransfer:{getData:()=>before[0]}});
  const edited=JSON.parse(storage.get(key));
  assert.equal(edited.finalRanking.at(-1),before[0]);
  get=await mount();
  assert.equal(W.replay(JSON.parse(storage.get(key)),roster).finalRanking.at(-1),before[0]);
  fail=true;get('#tier-ballot').onsubmit({preventDefault(){}});await new Promise(setImmediate);
  assert.match(get('#vote-status').textContent,/저장 실패/);assert.ok(storage.has(key));assert.equal(get('#vote-submit').disabled,false);
  fail=false;get('#tier-ballot').onsubmit({preventDefault(){}});await new Promise(setImmediate);
  assert.match(get('#vote-status').textContent,/반영/);assert.equal(storage.has(key),false);
  assert.equal(submitted.finalRanking.at(-1),before[0]);
  await get('#vote-image').onclick();
  assert.equal(get('#vote-export').open,true);
  assert.equal(get('#vote-preview').src,'blob:worldcup');
  await get('#vote-share').onclick();assert.equal(shared,true);
 }
 console.log('Worldcup UI: guest/account access, both rosters, autosave/resume, undo, placement games, final drag ordering, failed-save retry and PNG sharing passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
