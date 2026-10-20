(function(root){'use strict';
function rules(lib,mode='focus'){
 const active=lib>=1,focus=active&&mode==='focus',upgraded=lib>=11;
 return{active,focus,perHit:focus?(upgraded?50:5):0,cap:focus?(upgraded?100000:10000):0,maxHits:focus?2000:0,deployBuff:active&&!focus?(upgraded?300:200):0,snipe:focus&&lib>=6?{seconds:lib>=16?7:10,percent:lib>=16?150:50}:null};
}
function counts(current=0){if(!Number.isInteger(current)||current<0||current>1e8)throw Error('스택은 0~100,000,000 정수로 입력하세요.');return [...new Set([0,100,250,500,1000,1500,2000,current])].sort((a,b)=>a-b);}
function input(state,side,stacks){if(!['you','partner'].includes(side)||side==='partner'&&!state.partnerEnabled)throw Error('계산 진영을 확인하세요.');if(stacks!==null&&(!Number.isInteger(stacks)||stacks<0||stacks>1e8))throw Error('스택 범위를 확인하세요.');return{...state,[side]:{...state[side],claraInput:stacks===null?'solve':'manual',claraStacks:stacks??state[side].claraStacks}};}
root.CoopClara={rules,counts,input};if(typeof module!=='undefined')module.exports=root.CoopClara;
})(globalThis);
