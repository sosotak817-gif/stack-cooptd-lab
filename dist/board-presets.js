(function(root){'use strict';
const cell=(slug,row,col,lib=true)=>({slug,row,col,lib,nolib:!lib});
const top=middle=>[cell('cannon',6,1),cell('ivy',6,2),cell(middle,6,3),cell('omen',6,4),cell('ice-knight',6,5),cell('surprise-mouse',7,3),cell('latest-helicopter-machine',8,1)];
const marks=[{row:6,col:2,storms:1},{row:6,col:3,storms:1},{row:6,col:4,boost:true,storms:1},{row:7,col:3,storms:1},{row:8,col:3,storms:1}];
const presets={aclaraKaiser:{name:'아클카덱',cells:[cell('ivy',6,2),cell('clara',6,3),cell('kaiser',6,4),cell('ice-knight',6,5),cell('cannon',7,3),cell('latest-helicopter-machine',8,3),cell('ivy',8,1,false),cell('witch-doctor',9,5),cell('witch-doctor',9,6,false),cell('witch-doctor',10,5,false),cell('ancient-blue-dragon',10,6)],marks:[{row:6,col:2,grace:true,boost:true},{row:6,col:3,grace:true,storms:1},{row:6,col:4,grace:true,storms:1},{row:6,col:5,grace:true},{row:7,col:3,storms:1},{row:8,col:3,storms:1}]},clara:{name:'클라라덱',cells:[...top('clara'),cell('witch-doctor',9,5),cell('witch-doctor',9,6,false),cell('witch-doctor',10,5,false),cell('ancient-blue-dragon',10,6)],marks},goblin:{name:'코블린덱',cells:[...top('coin-man'),cell('witch-doctor',8,0),cell('witch-doctor',9,0,false),cell('ancient-blue-dragon',9,1),cell('goblin-biker',8,5),cell('goblin-biker',8,6,false),cell('goblin-biker',9,5,false),cell('goblin-biker',9,6,false),cell('goblin-biker',10,5,false)],marks}};
function newAccount(engine,data){const p=structuredClone(engine.DEFAULT_PARAMS);p.levelSupreme=p.levelDemonGod=p.levelOther=1;p.lib=0;p.skinLevels=0;p.eggbyLevel=1;p.eggbyLib=0;p.eggbySkinLevels=0;p.eggbyAttached=false;for(const d of data.DEMONS)p.perDemon[d.slug]={...p.perDemon[d.slug],level:1,lib:0,skinLevels:0,gems:[]};return p}
function withDefaults(state,engine,data){if(state.unitDefaultsVersion===1)return state;const next=structuredClone(state);for(const side of ['you','partner']){const p=next[side];for(const d of data.DEMONS){const own=p.perDemon[d.slug],original=engine.DEFAULT_PARAMS.perDemon[d.slug];if(!own||JSON.stringify(own)===JSON.stringify(original))p.perDemon[d.slug]={...own,level:1,lib:0,skinLevels:0,gems:[]};else p.perDemon[d.slug]={level:p.levelSupreme,lib:p.lib,skinLevels:p.skinLevels,...own}}p.levelSupreme=p.levelDemonGod=p.levelOther=1;p.lib=0;p.skinLevels=0}next.unitDefaultsVersion=1;return next}
function applyPreset(state,id,side='you'){const preset=presets[id];if(!preset)throw Error('프리셋을 찾을 수 없습니다.');const next=structuredClone(state),isSide=c=>side==='you'?c.row>5:c.row<5;const position=c=>side==='you'?{...c}:{...c,row:10-c.row};next.cells=[...next.cells.filter(c=>!isSide(c)),...structuredClone(preset.cells).map(position)];next.marks=[...(next.marks||[]).filter(c=>!isSide(c)),...structuredClone(preset.marks).map(position)];return next}
function hasPartnerDeck(state){return !!state.partnerEnabled&&state.cells.some(c=>c.row<5)}
function giantInput(state,basis){
 const next=structuredClone(state);
 if(!basis&&hasPartnerDeck(state))basis='partner';
 if(!['solo','mirror','partner'].includes(basis))throw Error('거인 계산 인원을 선택해 주세요.');
 if(basis==='partner'){if(!hasPartnerDeck(state))throw Error('활성 파트너 덱이 없습니다.');return{...next,giantBasis:basis}}
 const cells=next.cells.filter(c=>c.row>5),marks=(next.marks||[]).filter(m=>m.row>5);
 if(!cells.length)throw Error('내 진영에 초마신을 먼저 배치해 주세요.');
 next.cells=cells;next.marks=marks;next.partnerEnabled=basis==='mirror';
 if(basis==='mirror'){
  const reflect=value=>({...structuredClone(value),row:10-value.row});
  next.partner=structuredClone(next.you);
  next.cells=[...cells,...cells.map(reflect)];
  next.marks=[...marks,...marks.map(m=>({...reflect(m),...(m.stormBy?{stormBy:m.stormBy.map(reflect)}:{}),...(m.contract?{contract:reflect(m.contract)}:{})}))];
 }
 return{...next,giantBasis:basis};
}
function maxAccount(account,E,D,mode,catalog=root.CoopDealerRecommendations){const copy=structuredClone(account);copy.perDemon={...copy.perDemon};for(const d of D.DEMONS){const lib=D.NO_LIBERATION.has(d.slug)?0:20,entry=catalog?.modes?.[mode]?.rows?.find(r=>r.slug===d.slug);if(D.SUPREME_SLUGS.has(d.slug)&&lib&&(!entry||entry.gems?.length!==3))throw Error('최상 세팅 추천 보석 데이터를 불러오지 못했습니다. 새로고침해 주세요.');copy.perDemon[d.slug]={...copy.perDemon[d.slug],level:D.maxLevelFor(d.slug),lib,skinLevels:2,relicLevel:32,gems:lib?(entry?.gems||E.recommendedGems(d.slug)||[]).filter(Boolean).map(g=>({...g,grade:'SSS'})):[]};if(d.slug==='clara'&&entry?.claraMode)copy.claraMode=entry.claraMode;}return copy;}
function maxState(state,E,D,catalog=root.CoopDealerRecommendations){const next=structuredClone(state);for(const side of ['you','partner'])next[side]=maxAccount(next[side],E,D,next.mode,catalog);next.cells=next.cells.map(c=>({...c,lib:!D.NO_LIBERATION.has(c.slug),nolib:D.NO_LIBERATION.has(c.slug)}));return next;}
root.CoopPresets={maxAccount,maxState,presets,newAccount,withDefaults,applyPreset,hasPartnerDeck,giantInput};if(typeof module!=='undefined')module.exports=root.CoopPresets;
})(globalThis);
