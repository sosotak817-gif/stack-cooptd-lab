(function(){'use strict';
function snapshot(){
 let saved;try{saved=JSON.parse(localStorage.getItem('coop-lab-board-v2'));}catch{}
 if(saved?.version===2&&saved.you?.perDemon&&saved.partner?.perDemon){try{return CoopPresets.withDefaults(structuredClone(saved),CoopEngine,CoopData);}catch{}}
 return{version:2,unitDefaultsVersion:1,partnerEnabled:false,cells:[],marks:[],mode:'deepsea',target:'deepsea:SpecialBoss:100:0',you:CoopPresets.newAccount(CoopEngine,CoopData),partner:CoopPresets.newAccount(CoopEngine,CoopData)};
}
async function calculate(input){return new Promise((resolve,reject)=>{
 const version=new URL(document.querySelector('script[src*="ranking-page.js"]').src).searchParams.get('v')||'';
 const worker=new Worker('/board-worker.js'+(version?'?v='+version:''));
 const finish=(error,result)=>{clearTimeout(timeout);worker.terminate();error?reject(error):resolve(result);};
 const timeout=setTimeout(()=>finish(Error('계산 시간이 초과되었습니다. 다시 시도해 주세요.')),30000);
 worker.onmessage=({data})=>finish(data.error?Error(data.error):null,data);
 worker.onerror=event=>finish(Error(event.message||'계산에 실패했습니다.'));
 worker.postMessage({...input,id:1});
});}
window.StackLabRanking={snapshot,calculate};
})();
