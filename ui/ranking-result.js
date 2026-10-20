(function(){'use strict';
const box=document.getElementById('score-ranking'),R=CoopRankUI;
let generation=0,timer,controller,catalogPromise,pending=false;
const cache=new Map();
function clear(){generation++;clearTimeout(timer);controller?.abort();box.replaceChildren();}
function plain(text,href='/rankings/'){
 box.replaceChildren();const link=document.createElement('a');link.href=href;link.textContent=text;box.append(link);
}
async function refresh(){
 if(pending)return;
 clear();const id=generation,snapshot=StackLabRanking.snapshot(),deck=R.presetFor(snapshot);
 if(!deck){plain('솔로 전투력 랭킹 보기');return;}
 const result=StackLabRanking.result();
 if(!result||!Number.isFinite(result.actual)||result.actual<=0)return;
 const href='/rankings/?'+new URLSearchParams({deck,target:snapshot.target});
 timer=setTimeout(async()=>{
  try{
   const catalog=await(catalogPromise??=fetch('/ranking-catalog.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('랭킹 설정 오류');return r.json();}));
   if(id!==generation)return;
   if(!catalog.targets.some(t=>t.id===snapshot.target)){plain('보스 솔로 랭킹 보기');return;}
   const key=deck+':'+snapshot.target;let data=cache.get(key);
   if(!data||Date.now()-data.time>15000){
    controller=new AbortController();
    data={...await R.request('/api/rankings?'+new URLSearchParams({deck,target:snapshot.target}),{headers:R.auth(),signal:controller.signal}),time:Date.now()};
    if(id!==generation)return;
    cache.set(key,data);
   }
   if(id!==generation)return;
   if(data.revision!==catalog.revision){plain('새로고침 후 랭킹 확인',href);return;}
   const rank=data.mine?.rank??(R.participated(catalog.revision,deck,snapshot.target)?'1000+':null);
   if(rank===null){plain('인게임 닉네임으로 랭킹 등록',href);return;}
   if(data.mine)R.remember(catalog.revision,deck,snapshot.target);
   const link=document.createElement('a');link.href=href;link.className='score-rank-link';
   const label=document.createElement('span');label.textContent=CoopPresets.presets[deck].name+' 내 최고 기록';
   link.append(label,R.badge(rank));
   if(data.mine){link.title=data.mine.nickname+' · 등록 최고 전투력 '+Number(data.mine.score).toLocaleString('ko-KR',{maximumFractionDigits:2});}
   box.replaceChildren(link);
  }catch(error){if(id!==generation||error.name==='AbortError')return;catalogPromise=null;plain('랭킹 연결 대기',href);}
 },350);
}
window.addEventListener('stack-lab:calculation-pending',()=>{pending=true;clear();});
window.addEventListener('stack-lab:result',()=>{pending=false;refresh();});
window.addEventListener('stack-lab:ranking-updated',()=>{cache.clear();refresh();});
window.addEventListener('focus',()=>{if(StackLabRanking.result())refresh();});
if(StackLabRanking.result())refresh();
})();
