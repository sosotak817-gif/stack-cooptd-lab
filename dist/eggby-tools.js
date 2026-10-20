(function(root){'use strict';
const sideOf=cell=>cell.row>5?'you':'partner';
function normalize(params,engine){const p={...params,eggbyLevel:params.eggbyLevel??1,eggbyLib:params.eggbyLib??0,eggbySkinLevels:params.eggbySkinLevels??0};p.eggbyLib=engine.eggbyLibOf(p);return p;}
function info(params,engine,data){const p=normalize(params,engine),lib=p.eggbyLib,unattached=engine.effectiveLevel({...p,eggbyAttached:false},'oni'),mir=engine.effectiveLevel({...p,eggbyAttached:true,eggbyDragon:'mir'},'oni')-unattached;return{lib,level:p.eggbyLevel+p.eggbySkinLevels,baseAttack:lib>=1?data.liberationAtk('eggby',lib):0,mirLevels:mir,mirCrit:lib>=6?(lib>=16?1000:500):0,lunaAttack:lib>=6?engine.lunaGrace(p):0,flipHp:lib>=6?(lib>=16?10:5):0,fury:lib>=1?engine.furyStep(lib):null};}
function bulk(state,side,dragon,eligible){if(!['you','partner'].includes(side)||side==='partner'&&!state.partnerEnabled)throw Error('적용 진영을 확인하세요.');if(!['','mir','luna','flip'].includes(dragon))throw Error('에그비 종류를 선택하세요.');const next=structuredClone(state);let changed=0;for(const c of next.cells){if(sideOf(c)!==side||dragon&&!eligible(c.slug))continue;if((c.eggby||'')!==dragon)changed++;if(dragon)c.eggby=dragon;else delete c.eggby;}return{state:next,changed};}
root.CoopEggby={normalize,info,bulk};if(typeof module!=='undefined')module.exports=root.CoopEggby;
})(globalThis);
