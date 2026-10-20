(function(){'use strict';
const $=id=>document.getElementById(id), panel=$('rankings');
let catalog, page=1, total=0, generation=0, controller, busy=false;
const message=text=>{$('ranking-status').textContent=text;};
function token(){
 let value=localStorage.getItem('stack-lab-ranking-token');
 if(!/^[a-f0-9]{64}$/.test(value||'')){
  value=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
  localStorage.setItem('stack-lab-ranking-token',value);
 }
 return value;
}
function auth(){try{return {Authorization:'Bearer '+token()};}catch{return {};}}
function controls(){
 $('ranking-prev').disabled=busy||page<=1;
 $('ranking-next').disabled=busy||page*50>=total;
 for(const id of ['ranking-deck','ranking-map','ranking-target','ranking-name','ranking-refresh','ranking-submit']) $(id).disabled=busy;
 $('ranking-page').textContent=page+' / '+Math.max(1,Math.ceil(total/50));
}
function targets(){
 const select=$('ranking-target');select.replaceChildren();
 const list=catalog.targets.filter(t=>t.mode===$('ranking-map').value);
 for(const target of list){const option=document.createElement('option');option.value=target.id;option.textContent=target.name;select.append(option);}
 const current=window.StackLabRanking.snapshot().target;
 if(list.some(t=>t.id===current)) select.value=current;
}
async function request(url,options={}){
 const response=await fetch(url,{...options,cache:'no-store'});
 const data=await response.json().catch(()=>{throw Error('랭킹 API가 연결되지 않았습니다. Cloudflare Pages와 D1 설정을 확인해 주세요.');});
 if(!response.ok)throw Error(data.error||'랭킹 요청에 실패했습니다.');
 return data;
}
async function load(){
 controller?.abort();controller=new AbortController();const id=++generation;
 $('ranking-rows').replaceChildren();$('ranking-prev').disabled=$('ranking-next').disabled=true;
 message('랭킹을 불러오는 중…');
 const query=new URLSearchParams({deck:$('ranking-deck').value,target:$('ranking-target').value,page});
 try{
  const data=await request('/api/rankings?'+query,{signal:controller.signal,headers:auth()});
  if(id!==generation)return;
  if(data.revision!==catalog.revision)throw Error('계산 버전이 변경되었습니다. 새로고침해 주세요.');
  total=data.total;
  for(const entry of data.entries){
   const row=document.createElement('tr');if(entry.mine)row.className='ranking-mine';
   const values=[entry.rank,entry.nickname+(entry.mine?' (내 기록)':''),Number(entry.score).toLocaleString('ko-KR',{maximumFractionDigits:2}),new Date(entry.achievedAt).toLocaleDateString('ko-KR')];
   for(const value of values){const td=document.createElement('td');td.textContent=value;row.append(td);}
   $('ranking-rows').append(row);
  }
  message(total?'상위 '+total.toLocaleString('ko-KR')+'개 기록 · 동점은 먼저 달성한 기록 우선':'아직 등록된 기록이 없습니다. 첫 기록을 남겨보세요.');
 }catch(error){if(error.name==='AbortError')return;if(id===generation){total=0;message(error.message);}}
 finally{if(id===generation)controls();}
}
async function submit(event){
 event.preventDefault();if(busy)return;
 const nickname=$('ranking-name').value.trim();
 if(!/^[\p{L}\p{N} _.-]{1,20}$/u.test(nickname)){message('닉네임은 문자·숫자·공백·밑줄·점·하이픈으로 1~20자입니다.');return;}
 const deck=$('ranking-deck').value,target=$('ranking-target').value;
 const selected=catalog.targets.find(t=>t.id===target), snapshot=window.StackLabRanking.snapshot();
 const preset=CoopPresets.presets[deck];
 // Fixed placements and fields; current edits and partner never enter ranking calculations.
 Object.assign(snapshot,{mode:selected.mode,target,partnerEnabled:false,cells:structuredClone(preset.cells),marks:structuredClone(preset.marks)});
 let credential;try{credential=token();}catch{message('기록 갱신을 위해 브라우저 저장 공간을 허용해 주세요.');return;}
 busy=true;controls();message('고정 프리셋으로 솔로 전투력을 계산하는 중…');
 try{
  const result=await window.StackLabRanking.calculate(snapshot),score=result.actual/1e12;
  if(!Number.isFinite(score)||score<=0)throw Error('등록할 수 있는 전투력이 없습니다. 성장 세팅을 확인해 주세요.');
  const data=await request('/api/rankings',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+credential},body:JSON.stringify({revision:catalog.revision,deck,target,nickname,score})});
  try{localStorage.setItem('stack-lab-ranking-name',nickname);}catch{}
  page=1;await load();
  message(data.retained?(data.improved?'최고 기록 등록 완료 · ':'기존 최고 기록 유지 · ')+Number(data.score).toLocaleString('ko-KR',{maximumFractionDigits:2}):'전투력을 계산했지만 상위 1,000등에 들지 않아 기록을 보관하지 않았습니다.');
 }catch(error){message(error.message);}finally{busy=false;controls();}
}
panel.addEventListener('toggle',async()=>{
 if(!panel.open||catalog)return;
 try{
  message('랭킹 설정을 불러오는 중…');
  const response=await fetch('/ranking-catalog.json',{cache:'no-store'});if(!response.ok)throw Error('랭킹 설정을 불러올 수 없습니다.');
  catalog=await response.json();
  $('ranking-map').value=window.StackLabRanking.snapshot().mode;targets();
  try{$('ranking-name').value=localStorage.getItem('stack-lab-ranking-name')||'';}catch{}
  $('ranking-form').hidden=false;
  for(const id of ['ranking-deck','ranking-map','ranking-target'])$(id).onchange=()=>{if(id==='ranking-map')targets();page=1;load();};
  $('ranking-prev').onclick=()=>{if(page>1){page--;load();}};
  $('ranking-next').onclick=()=>{if(page*50<total){page++;load();}};
  $('ranking-refresh').onclick=()=>load();$('ranking-form').onsubmit=submit;
  await load();
 }catch(error){catalog=null;message(error.message);}
});
})();
