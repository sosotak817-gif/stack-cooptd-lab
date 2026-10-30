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
function shares(rows){const total={you:0,partner:0};for(const row of rows)for(const side of ['you','partner'])total[side]+=row.damageBySide?.[side]||0;return total;}
root.CoopStageCompare={reflect,extract,combine,swap,shares};if(typeof module!=='undefined')module.exports=root.CoopStageCompare;
})(globalThis);
