(function(root){'use strict';
function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v)}
function cacheInput(input,revision){return canonical({revision,partnerEnabled:!!input.partnerEnabled,mode:input.mode,target:input.target,you:input.you,partner:input.partner,cells:input.cells,marks:input.marks||[]})}
const clone=value=>structuredClone(value),sideOf=p=>p.row>5?'you':'partner',same=(a,b)=>a.row===b.row&&a.col===b.col;
// A storm is movable independently; critical tiles do not stack.
function markMoves(marks){return marks.flatMap((m,index)=>[...m.boost?[{index,type:'boost'}]:[],...Array.from({length:m.storms||0},(_,storm)=>({index,type:'storms',storm}))])}
function moveMark(marks,move,to){const next=clone(marks),from=next[move.index];if(same(from,to))return null;let target=next.find(m=>same(m,to));if(move.type==='boost'&&target?.boost||move.type==='storms'&&(target?.storms||0)>=4)return null;if(!target){target={row:to.row,col:to.col};next.push(target)}if(move.type==='boost'){delete from.boost;target.boost=true}else{const owner=from.stormBy?.[move.storm];if(from.stormBy)from.stormBy.splice(move.storm,1);from.storms--;const count=target.storms||0;target.storms=count+1;if(owner||target.stormBy){target.stormBy??=Array(count).fill(null);target.stormBy.push(owner||null)}}return next.filter(m=>m.boost||m.storms||Object.keys(m).some(k=>!['row','col','boost','storms','stormBy'].includes(k)))}
function moveUnit(cells,marks,index,to){const next=clone(cells),from={row:next[index].row,col:next[index].col},other=next.findIndex(c=>same(c,to));if(other>=0)Object.assign(next[other],from);Object.assign(next[index],to);const linked=clone(marks);for(const m of linked)if(m.stormBy)m.stormBy=m.stormBy.map(owner=>!owner?owner:same(owner,from)?{...to}:other>=0&&same(owner,to)?{...from}:owner);return{cells:next,marks:linked}}
async function optimize({cells,marks=[],tiles,evaluate,maxEvaluations=160,timeLimit=12000,movableSides=['you','partner'],onProgress=()=>{},cancelled=()=>false,seed=12345}){
 let randomState=seed>>>0;const rnd=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296};const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 const started=performance.now();let evaluated=0,hits=0,errors=0,passes=0;
 const run=async candidate=>{const r=await evaluate(candidate.cells,candidate.marks);evaluated++;if(r.cached)hits++;return r};
 let bestLayout={cells:clone(cells),marks:clone(marks)},best=await run(bestLayout),current=best,currentLayout=clone(bestLayout);const baseline=best.actual;
 const inBudget=()=>evaluated<maxEvaluations&&performance.now()-started<timeLimit&&!cancelled();
 const progress=async()=>{onProgress({evaluated,hits,errors,best:best.actual,baseline,elapsed:performance.now()-started});await new Promise(resolve=>setTimeout(resolve,0))};
 const consider=async candidate=>{let r;try{r=await run(candidate)}catch{errors++;return false}const improved=r.actual>current.actual+Math.max(1,current.actual)*1e-10;if(improved){currentLayout=candidate;current=r;if(r.actual>best.actual){best=r;bestLayout=clone(candidate)}}await progress();return improved};
 while(inBudget()){
  let improved=false;
  // Interleave field and unit searches so fields receive budget on crowded maps.
  const units=shuffle(cells.map((c,index)=>({kind:'unit',index,side:sideOf(c)})).filter(t=>movableSides.includes(t.side))),fields=shuffle(markMoves(currentLayout.marks).filter(m=>movableSides.includes(sideOf(currentLayout.marks[m.index]))).map((m,ordinal)=>({kind:'mark',ordinal}))),tasks=[];
  while(units.length||fields.length){if(fields.length)tasks.push(fields.shift());if(units.length)tasks.push(units.shift())}
  for(const task of tasks){if(!inBudget())break;
   // Merges change indices, so resolve the current storm/critical token afresh.
   const moves=task.kind==='mark'?markMoves(currentLayout.marks).filter(m=>movableSides.includes(sideOf(currentLayout.marks[m.index]))):[],active=moves.length?moves[task.ordinal%moves.length]:null;
   const from=task.kind==='unit'?currentLayout.cells[task.index]:active?currentLayout.marks[active.index]:null;if(!from)continue;
   for(const to of shuffle([...tiles[sideOf(from)]])){if(!inBudget())break;if(same(from,to))continue;let candidate;if(task.kind==='unit')candidate=moveUnit(currentLayout.cells,currentLayout.marks,task.index,to);else{const next=moveMark(currentLayout.marks,active,to);if(!next)continue;candidate={cells:clone(currentLayout.cells),marks:next}}if(await consider(candidate)){improved=true;break}}
  }
  passes++;
  if(!improved&&inBudget()){
   let restart=clone(bestLayout);
   for(const side of movableSides){const slots=shuffle([...tiles[side]]);const indices=restart.cells.map((c,index)=>({c,index})).filter(({c})=>sideOf(c)===side).map(({index})=>index);for(let i=0;i<indices.length;i++)restart=moveUnit(restart.cells,restart.marks,indices[i],slots[i])}
   const count=markMoves(restart.marks).length;for(let i=0;i<count;i++){const moves=markMoves(restart.marks).filter(m=>movableSides.includes(sideOf(restart.marks[m.index])));if(!moves.length)break;const m=moves[Math.floor(rnd()*moves.length)],from=restart.marks[m.index],slots=tiles[sideOf(from)];restart.marks=moveMark(restart.marks,m,slots[Math.floor(rnd()*slots.length)])||restart.marks}
   try{current=await run(restart);currentLayout=restart;if(current.actual>best.actual){best=current;bestLayout=clone(restart)}}catch{errors++;current=best;currentLayout=clone(bestLayout)}await progress();
  }
 }
 return{...bestLayout,result:best,baseline,evaluated,hits,errors,passes,cancelled:cancelled(),elapsed:performance.now()-started};
}
function composition(input,entries,side,boostCount,E,D,G){if(!['you','partner'].includes(side)||side==='partner'&&!input.partnerEnabled)throw Error('활성 진영을 선택하세요.');const tiles=G.tilesOf(side),seen=new Set;let total=0;for(const e of entries){if(!D.SUPREME_SLUGS.has(e.slug)||seen.has(e.slug)||!Number.isInteger(e.count)||e.count<1||e.count>tiles.length)throw Error('초마신 종류·수량을 확인하세요.');seen.add(e.slug);total+=e.count;}if(!total||total>tiles.length)throw Error('합계 수량은 1~'+tiles.length+'개로 입력하세요.');if(!Number.isInteger(boostCount)||boostCount<0||boostCount>tiles.length)throw Error('헬기 장판 수를 확인하세요.');const p=input[side],lib=slug=>E.effectiveLib(p,slug),hasHeli=entries.some(e=>e.slug==='latest-helicopter-machine'&&lib(e.slug)>0);if(boostCount&&!hasHeli)throw Error('치명 장판을 사용하려면 해방 헬리콥터를 편성하세요.');const old=input.cells.filter(c=>sideOf(c)===side),cells=input.cells.filter(c=>sideOf(c)!==side).map(clone),used=new Set;for(const e of entries){const previous=old.filter(c=>c.slug===e.slug);for(let i=0;i<e.count;i++){const saved=previous[i],tile=saved&&!used.has(saved.row+':'+saved.col)?saved:tiles.find(t=>!used.has(t.row+':'+t.col));used.add(tile.row+':'+tile.col);cells.push({...saved,slug:e.slug,row:tile.row,col:tile.col,lib:i===0&&lib(e.slug)>0,nolib:i!==0||lib(e.slug)<=0});}}const marks=clone(input.marks||[]).flatMap(m=>{if(sideOf(m)!==side)return[m];delete m.boost;delete m.storms;delete m.stormBy;return Object.keys(m).some(k=>!['row','col'].includes(k))?[m]:[];});const mark=tile=>{let m=marks.find(m=>same(m,tile));if(!m){m={row:tile.row,col:tile.col};marks.push(m);}return m;};for(let i=0;i<boostCount;i++)mark(tiles[i]).boost=true;const witch=cells.find(c=>sideOf(c)===side&&c.slug==='witch-doctor'&&!c.nolib);if(witch&&lib('witch-doctor')>=6){const m=mark(tiles[Math.min(boostCount,tiles.length-1)]);m.storms=1;m.stormBy=[{row:witch.row,col:witch.col}];}return{cells,marks};}
root.CoopOptimize={canonical,cacheInput,optimize,composition};if(typeof module!=='undefined')module.exports=root.CoopOptimize;
})(globalThis);
