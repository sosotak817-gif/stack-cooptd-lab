const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
require('./dist/engine.js');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.style={setProperty(){}};this.classList={add(){},remove(){}};}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(){}
 addEventListener(){}
}
(async()=>{
 const rankings=JSON.parse(fs.readFileSync('dist/dealer-rankings.json','utf8'));
 for(const saved of [null,{S:[],A:[],B:[],C:[],D:[]}]){
  const nodes=new Map(),get=s=>{if(!nodes.has(s))nodes.set(s,new Element('div'));return nodes.get(s);};
  get('#dealer-mode').value='deepsea';
  const context={CoopData,CoopTargets,URL,console,Option:function(text,value){this.text=text;this.value=value;},document:{currentScript:{src:'https://example.test/dealer-tiers-page.js'},querySelector:get,createElement:tag=>new Element(tag)},localStorage:{getItem:()=>JSON.stringify(saved),setItem(){}},fetch:url=>{const result=Promise.resolve({ok:true,json:async()=>url.includes('ko.json')?{}:rankings});return result;}};
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
   get('#dealer-reset').onclick();
   assert.equal(board.children.length,5,'automatic reset must retain visible tiers');
  }
 }
 console.log('Dealer tier rendering: five modes, fresh/saved layouts, all tier rows and unit cards, rankings and reset passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
