const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {optimize,cacheInput}=require('./ui/optimizer-core.js');
(async()=>{
 const tiles={you:[{row:6,col:1},{row:6,col:2},{row:7,col:3}],partner:[{row:4,col:1},{row:4,col:2},{row:3,col:3}]};
 const cells=[{slug:'oni',row:6,col:2,lib:true,eggby:'mir'},{slug:'witch-doctor',row:7,col:3,lib:true},{slug:'oni',row:4,col:2,lib:true}];
 const marks=[{row:6,col:1,boost:true,storms:2,stormBy:[{row:7,col:3},{row:7,col:3}]},{row:4,col:1,boost:true,storms:1}];
 const before=structuredClone({cells,marks}),totals=ms=>['you','partner'].map(side=>ms.filter(m=>(m.row>5?'you':'partner')===side).reduce((n,m)=>({boost:n.boost+Number(!!m.boost),storms:n.storms+(m.storms||0)}),{boost:0,storms:0}));
 const evaluate=async(cs,ms)=>{const witch=cs.find(c=>c.slug==='witch-doctor');for(const m of ms)for(const by of m.stormBy||[])assert.deepEqual(by,{row:witch.row,col:witch.col},'storm owner follows a moving or swapped witch');return{actual:cs.filter(c=>c.slug==='oni'&&c.col===2).length*10000+ms.reduce((n,m)=>n+(m.col===2?Number(!!m.boost)*100+(m.storms||0)*50:0),0)}};
 const result=await optimize({cells,marks,tiles,evaluate,maxEvaluations:150,timeLimit:3000});
 assert.ok(result.result.actual>result.baseline,'fields improve a board even when units already occupy the best slots');
 assert.deepEqual(totals(result.marks),totals(marks),'critical tile count and storm total stay on their own side');
 assert.deepEqual({cells,marks},before,'search never mutates the saved original');
 assert.equal(new Set(result.marks.map(m=>m.row+','+m.col)).size,result.marks.length);
 assert.ok(result.marks.every(m=>!m.storms||m.storms<=4));
 const cancelled=await optimize({cells,marks,tiles,evaluate,cancelled:()=>true});assert.deepEqual(cancelled.marks,marks);assert.deepEqual(cancelled.cells,cells);
 const base={cells,marks,you:{traits:[]},partner:{traits:[]},mode:'deepsea',target:'boss'};
 for(const change of [x=>x.marks[0].col=2,x=>x.marks[0].storms=1,x=>x.marks[0].boost=false,x=>x.you.traits=[{id:'atk',rank:'SS',value:100}],x=>x.partner.traits=[{id:'enemy-def',rank:'SS',value:20}]]){const input=structuredClone(base);change(input);assert.notEqual(cacheInput(input,'1'),cacheInput(base,'1'))}
 // Check the complete original trait table against the compiled engine.
 const {load,ctx}=require('./inspect.cjs'),source=load(98018),extras=load(86245),db=load(34621),original=x=>vm.runInContext('JSON.parse',ctx)(JSON.stringify(x));
 const sandbox={console,URL,URLSearchParams,TextEncoder,TextDecoder,performance,setTimeout,clearTimeout,Buffer};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('dist/engine.js','utf8'),sandbox);const generated=x=>vm.runInContext('JSON.parse',sandbox)(JSON.stringify(x));
 let cases=0;for(const tr of extras.TRAITS)for(const rank of extras.traitRanks(tr)){const p=structuredClone(source.DEFAULT_PARAMS);p.traits=[{id:tr.id,rank,value:tr.ranges[rank][1]}];const a=source.computeDemon(db.DEMON_BY_SLUG.get('oni'),original(p)),b=sandbox.CoopEngine.computeDemon(sandbox.CoopData.DEMON_BY_SLUG.get('oni'),generated(p));assert.equal(a.dps,b.dps);cases++}
 const p=structuredClone(source.DEFAULT_PARAMS);p.traits=[];const stats=traits=>source.computeDemon(db.DEMON_BY_SLUG.get('oni'),original({...p,traits})).stats,bare=stats([]);
 for(const [id,key]of [['atk','atkPct'],['crit-dmg','critDmg'],['crit-rate','rawCritRate'],['enemy-def','defShred']])assert.ok(stats([{id,rank:'SS',value:extras.TRAIT_BY_ID.get(id).ranges.SS[1]}])[key]>bare[key],id+' contributes to combat stats');
 console.log(`Joint optimizer: moves fields, preserves counts/sides/owners, cancellation and cache separation. Traits: ${cases} original parity cases and all four combat effects passed.`);
})().catch(error=>{console.error(error);process.exitCode=1});
