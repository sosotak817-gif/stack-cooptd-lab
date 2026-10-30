(function(root){'use strict';
const sideOf=v=>v.row>5?'you':v.row<5?'partner':null;
function reflect(value){if(Array.isArray(value))return value.map(reflect);if(!value||typeof value!=='object')return value;return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='row'&&Number.isInteger(v)?10-v:reflect(v)]));}
function extract(state,side){
 const cells=state.cells.filter(c=>sideOf(c)===side),marks=(state.marks||[]).filter(m=>sideOf(m)===side).map(m=>({...m,...(m.stormBy?{stormBy:m.stormBy.filter(v=>sideOf(v)===side)}:{})}));
 if(!cells.length)throw Error('선택한 진영에 배치된 유닛이 없습니다.');
 return {account:structuredClone(state[side]),cells:side==='partner'?reflect(cells):structuredClone(cells),marks:side==='partner'?reflect(marks):structuredClone(marks)};
}
function combine(base,a,b){return {...structuredClone(base),you:structuredClone(a.account),partner:structuredClone((b||a).account),cells:[...structuredClone(a.cells),...(b?reflect(b.cells):[])],marks:[...structuredClone(a.marks),...(b?reflect(b.marks):[])],partnerEnabled:!!b};}
function swap(state){return {...structuredClone(state),you:structuredClone(state.partner),partner:structuredClone(state.you),cells:reflect(state.cells),marks:reflect(state.marks||[])};}
function damageOf(row,kind='all'){return (kind==='all'?row.damageBySide:row.damageByKind?.[kind])||{you:0,partner:0};}
function shares(rows,kind='all'){const total={you:0,partner:0};for(const row of rows)for(const side of ['you','partner'])total[side]+=damageOf(row,kind)[side]||0;return total;}
function phases(lastWave){const a=Math.floor(lastWave/3),b=Math.floor(lastWave*2/3);return[{id:'early',name:'초반',from:1,to:a},{id:'middle',name:'중반',from:a+1,to:b},{id:'late',name:'후반',from:b+1,to:lastWave}];}
function rangeRows(report,scope='all',wave=null){const phase=phases(report.lastWave).find(p=>p.id===scope);return report.rows.filter(r=>r.reached&&(scope==='round'?r.wave===wave:phase?r.wave>=phase.from&&r.wave<=phase.to:true));}
function phaseSummary(report,kind='all'){return phases(report.lastWave).map(p=>{const rows=rangeRows(report,p.id);return{...p,reached:rows.length,lastReached:rows.at(-1)?.wave??null,damage:shares(rows,kind)};});}
function unitBreakdown(report,kind='all',scope='all',wave=null){
 const counts=new Map((report.units||[]).map(u=>[u.id,{...u,mob:0,boss:0,other:0,damage:0,deckShare:null,teamShare:null}]));
 for(const row of rangeRows(report,scope,wave))for(const [id,values]of Object.entries(report.unitDamageByWave?.[row.wave]||{})){const u=counts.get(id);if(u){u.mob+=values[0]||0;u.boss+=values[1]||0;u.other+=values[2]||0;}}
 const totals={you:0,partner:0};for(const u of counts.values()){u.damage=kind==='all'?u.mob+u.boss+u.other:u[kind]||0;totals[u.side]+=u.damage;}
 const sum=totals.you+totals.partner;for(const u of counts.values()){u.deckShare=totals[u.side]>0?u.damage/totals[u.side]:null;u.teamShare=sum>0?u.damage/sum:null;}
 return [...counts.values()].sort((a,b)=>b.damage-a.damage||a.side.localeCompare(b.side)||a.row-b.row||a.col-b.col);
}
root.CoopStageCompare={reflect,extract,combine,swap,shares,damageOf,phases,rangeRows,phaseSummary,unitBreakdown};if(typeof module!=='undefined')module.exports=root.CoopStageCompare;
})(globalThis);
