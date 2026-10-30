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
function pairingInput(input,key){
 if(key==='ab')return structuredClone(input);
 if(!['aa','bb'].includes(key))throw Error('알 수 없는 비교 조합입니다.');
 const deck=extract(input,key==='aa'?'you':'partner');return combine(input,deck,deck);
}
function compactTeam(report){const {waves,contribution,independent,pairings,bossCapacity,...team}=report;return team;}
function teamOutcome(report){
 const rows=report.rows.filter(r=>r.reached),final=report.rows.at(-1);
 return{passed:!!report.passed,reached:rows.at(-1)?.wave||0,firstRisk:report.firstRisk,lives:report.lives?.left??null,leaks:rows.reduce((n,r)=>n+(r.leaks||0),0),finalReached:!!final?.reached,finalSeconds:report.passed&&Number.isFinite(final?.seconds)?final.seconds:null};
}
function compatibility(report){
 const aa=report.pairings?.aa,bb=report.pairings?.bb;if(!aa||!bb)return{code:'pending',title:'동일 덱 조합 비교 중',detail:'A+A와 B+B 결과가 준비되면 혼합 조합의 차이를 설명합니다.'};
 const ab=teamOutcome(report),a=teamOutcome(aa),b=teamOutcome(bb),detail='A+A '+(a.passed?'클리어':a.firstRisk+'R 종료')+' · A+B '+(ab.passed?'클리어':ab.firstRisk+'R 종료')+' · B+B '+(b.passed?'클리어':b.firstRisk+'R 종료');
 if(ab.passed&&!a.passed&&!b.passed)return{code:'complement',title:'두 덱이 함께할 때 클리어',detail};
 if(ab.passed&&a.passed&&b.passed)return{code:'all-clear',title:'세 조합 모두 클리어',detail};
 if(!ab.passed&&(a.passed||b.passed))return{code:'same-clear',title:'동일 덱 조합에서 클리어 확인',detail};
 if(ab.passed)return{code:'mixed-clear',title:'혼합 조합과 동일 덱 조합 모두 클리어',detail};
 if(ab.firstRisk>Math.max(a.firstRisk,b.firstRisk))return{code:'further',title:'혼합 조합이 더 멀리 진행',detail};
 return{code:'no-gain',title:'혼합 조합의 추가 이점 미확인',detail};
}
function applyGems(slots,slug,gems,target,gemById,grades){
 if(!['a','b','both'].includes(target))throw Error('보석 적용 대상을 선택하세요.');
 const sides=target==='both'?['a','b']:[target];for(const side of sides)if(!slots[side]?.cells.some(c=>c.slug===slug))throw Error(side.toUpperCase()+' 덱에 해당 유닛이 없습니다.');
 if(!Array.isArray(gems)||gems.length!==3)throw Error('보석 슬롯 3개를 설정하세요.');
 const ids=new Set;for(const [i,g]of gems.entries()){if(!g?.id)continue;const data=gemById.get(g.id);if(!data||!!data.special!==(i===1)||!(i===1?['S','SS','SSS']:grades).includes(g.grade))throw Error('보석 종류·등급·슬롯을 확인하세요.');if(ids.has(g.id))throw Error('같은 보석을 중복 장착할 수 없습니다.');ids.add(g.id);}
 const next=structuredClone(slots);for(const side of sides){const account=next[side].account;account.perDemon[slug]={...account.perDemon[slug],gems:structuredClone(gems)};}return next;
}
root.CoopStageCompare={reflect,extract,combine,swap,shares,damageOf,phases,rangeRows,phaseSummary,unitBreakdown,pairingInput,compactTeam,teamOutcome,compatibility,applyGems};if(typeof module!=='undefined')module.exports=root.CoopStageCompare;
})(globalThis);
