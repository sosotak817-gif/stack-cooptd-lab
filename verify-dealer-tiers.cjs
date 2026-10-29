const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
require('./dist/engine.js');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.style={setProperty(){}};this.classList={add(){},remove(){}};}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(){}
 addEventListener(type,handler){(this.listeners??={})[type]=handler;}
 showModal(){this.open=true;}
 close(){this.open=false;}
 getBoundingClientRect(){return{left:10,right:100,top:10,bottom:100};}
}
(async()=>{
 const rankings=JSON.parse(fs.readFileSync('dist/dealer-rankings.json','utf8'));
 for(const saved of [null,{S:[],A:[],B:[],C:[],D:[]}]){
  const nodes=new Map(),get=s=>{if(!nodes.has(s))nodes.set(s,new Element('div'));return nodes.get(s);};
  get('#dealer-mode').value='deepsea';
  const context={CoopDealerTools:require('./ui/dealer-tools.js'),CoopEngine,CoopData,CoopTargets,URL,console,Option:function(text,value){this.text=text;this.value=value;},document:{currentScript:{src:'https://example.test/dealer-tiers-page.js'},querySelector:get,createElement:tag=>new Element(tag)},localStorage:{getItem:()=>JSON.stringify(saved),setItem(){}},fetch:url=>{const result=Promise.resolve({ok:true,json:async()=>url.includes('ko.json')?{}:rankings});return result;}};
  vm.runInNewContext(fs.readFileSync('ui/dealer-conditions.js','utf8'),context);
  vm.runInNewContext(fs.readFileSync('ui/dealer-tiers-page.js','utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  for(const mode of Object.keys(rankings.modes)){
   get('#dealer-mode').value=mode;get('#dealer-mode').onchange();
   const board=get('#dealer-tier-board'),expected=rankings.modes[mode].rows;
   assert.equal(board.children.length,5,'all five tier rows must be attached to the board');
   assert.deepEqual(board.children.map(row=>row.dataset.tier),['S','A','B','C','D']);
   const cards=board.children.flatMap(row=>row.children[1].children).filter(card=>card.dataset.slug);
   assert.equal(cards.length,expected.length,'every ranked unit must be visible');
   assert.equal(new Set(cards.map(card=>card.dataset.slug)).size,expected.length);
   assert.equal(get('#dealer-ranking-list').children.length,expected.length);
   const coin=cards.find(card=>card.dataset.slug==='coin-man');coin.listeners.click();assert.equal(get('#dealer-condition-dialog').open,true);const conditions=get('#dealer-condition-content').children.map(p=>p.children.map(n=>n.textContent).join(' ')).join(' ');assert.ok(conditions.includes(({hell:1000000,abyss:4000000})[mode]?.toLocaleString('ko-KR')||'25,000,000'));assert.match(conditions,/보석/);assert.equal(get('#dealer-condition-content').children[0].children[0].href,'/units/?unit=coin-man&benchmark='+mode);const popup=get('#dealer-condition-dialog');popup.listeners.click({target:popup,clientX:20,clientY:20});assert.equal(popup.open,true,'clicks inside the dialog do not dismiss');popup.listeners.click({target:popup,clientX:0,clientY:0});assert.equal(popup.open,false,'backdrop clicks dismiss the popup');coin.listeners.keydown({key:'Enter',preventDefault(){}});
   get('#dealer-ranking-list').children[0].children[2].children[0].onclick();assert.match(get('#dealer-condition-title').textContent,/계산 조건/);
   get('#dealer-reset').onclick();
   assert.equal(board.children.length,5,'automatic reset must retain visible tiers');
  }
 }
 console.log('Dealer tier rendering: five modes, fresh/saved layouts, all tier rows and unit cards, rankings and reset passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
