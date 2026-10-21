(function(){'use strict';
const $=id=>document.getElementById(id),panel=$('rankings'),R=CoopRankUI;
let catalog,page=1,total=0,generation=0,controller,busy=false,initializing=false,recordRevision=null; 
const message=text=>{$('ranking-status').textContent=text;};
function controls(){
 $('ranking-prev').disabled=busy||page<=1;$('ranking-next').disabled=busy||page*50>=total;
 for(const id of ['ranking-deck','ranking-map','ranking-target','ranking-name','ranking-refresh','ranking-submit'])$(id).disabled=busy;
 $('ranking-page').textContent=page+' / '+Math.max(1,Math.ceil(total/50));
}
function ownRecord(record){
 const box=$('ranking-own');box.replaceChildren();
 const label=document.createElement('span');label.textContent='내 최고 기록';box.append(label);
 const rank=record?.rank??(R.participated(recordRevision||catalog.revision,$('ranking-deck').value,$('ranking-target').value)?'1000+':null);
 box.append(R.badge(rank));
 if(record){
  R.remember(recordRevision||catalog.revision,$('ranking-deck').value,$('ranking-target').value);
  const detail=document.createElement('span');detail.textContent=record.nickname+' · 전투력 '+Number(record.score).toLocaleString('ko-KR',{maximumFractionDigits:2});box.append(detail);
  if(!$('ranking-name').value)$('ranking-name').value=record.nickname;
 }else if(rank==='1000+'){
  const detail=document.createElement('span');detail.textContent='상위 1,000위 밖';box.append(detail);
 }
}
function targets(preferred){
 const select=$('ranking-target');select.replaceChildren();
 const list=catalog.targets.filter(t=>t.mode===$('ranking-map').value);
 for(const target of list){const option=document.createElement('option');option.value=target.id;option.textContent=target.name;select.append(option);}
 if(list.some(t=>t.id===preferred))select.value=preferred;
}
async function load(){
 controller?.abort();controller=new AbortController();const id=++generation;
 $('ranking-rows').replaceChildren();$('ranking-own').replaceChildren();$('ranking-prev').disabled=$('ranking-next').disabled=true;
 message('랭킹을 불러오는 중…');
 const deck=$('ranking-deck').value,target=$('ranking-target').value;
 const query=new URLSearchParams({deck,target,page,...recordRevision?{revision:recordRevision}:{}});
 const link=$('ranking-full-link');if(link)link.href='/rankings/?'+new URLSearchParams({deck,target});
 if(panel.dataset.page==='true')history.replaceState(null,'','/rankings/?'+new URLSearchParams({deck,target}));
 try{
  const data=await R.request('/api/rankings?'+query,{signal:controller.signal,headers:R.auth()});
  if(id!==generation)return;
  if(data.revision!==catalog.revision)throw Error('계산 버전이 변경되었습니다. 새로고침해 주세요.');
  total=data.total;recordRevision=data.recordRevision||catalog.revision;let versions=$('ranking-history');if(!versions){versions=document.createElement('select');versions.id='ranking-history';versions.setAttribute('aria-label','저장된 랭킹 기록');$('ranking-status').before(versions);versions.onchange=()=>{recordRevision=versions.value;page=1;load();};}versions.replaceChildren();for(const revision of [...new Set([catalog.revision,...(data.revisions||[]).map(r=>r.revision)])]){const option=document.createElement('option');option.value=revision;option.textContent=revision===catalog.revision?'현재 누적 랭킹':'이전 기록 · '+revision.slice(0,8);versions.append(option);}versions.value=recordRevision;ownRecord(data.mine);
  for(const entry of data.entries){
   const row=document.createElement('tr');if(entry.mine)row.className='ranking-mine';
   const position=document.createElement('td');position.append(R.badge(entry.rank));row.append(position);
   const values=[entry.nickname+(entry.mine?' (내 기록)':''),Number(entry.score).toLocaleString('ko-KR',{maximumFractionDigits:2}),new Date(entry.achievedAt).toLocaleDateString('ko-KR')];
   for(const value of values){const td=document.createElement('td');td.textContent=value;row.append(td);}
   $('ranking-rows').append(row);
  }
  message(total?(data.archived?'이전 계산 기록 보존 · ':'누적 최고 기록 · ')+'상위 '+total.toLocaleString('ko-KR')+'개 기록 · 동점은 먼저 달성한 기록 우선':'아직 등록된 기록이 없습니다. 첫 기록을 남겨보세요.');
 }catch(error){if(error.name==='AbortError')return;if(id===generation){total=0;message(error.message);}}
 finally{if(id===generation)controls();}
}
async function submit(event){
 event.preventDefault();if(busy)return;
 const nickname=$('ranking-name').value.normalize('NFC').trim();
 if(!nickname||Array.from(nickname).length>20||/[\p{Cc}\p{Cf}\p{Cs}]/u.test(nickname)){message('인게임 닉네임을 1~20자로 입력해 주세요.');return;}
 const deck=$('ranking-deck').value,target=$('ranking-target').value;
 const selected=catalog.targets.find(t=>t.id===target),snapshot=window.StackLabRanking.snapshot(),preset=CoopPresets.presets[deck];
 Object.assign(snapshot,{mode:selected.mode,target,partnerEnabled:false,cells:structuredClone(preset.cells),marks:structuredClone(preset.marks)});
 let credential;try{credential=R.token();}catch{message('기록 갱신을 위해 브라우저 저장 공간을 허용해 주세요.');return;}
 busy=true;controller?.abort();generation++;controls();message('고정 프리셋으로 솔로 전투력을 계산하는 중…');
 try{
  const result=await window.StackLabRanking.calculate(snapshot),score=result.actual/1e12;
  if(!Number.isFinite(score)||score<=0)throw Error('등록할 수 있는 전투력이 없습니다. 성장 세팅을 확인해 주세요.');
  const data=await R.request('/api/rankings',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+credential},body:JSON.stringify({revision:catalog.revision,deck,target,nickname,score})});
  try{localStorage.setItem('stack-lab-ranking-name',nickname);}catch{}
  R.remember(recordRevision||catalog.revision,deck,target);
  window.dispatchEvent(new CustomEvent('stack-lab:ranking-updated',{detail:{deck,target}}));
  page=1;await load();
  message(data.retained?(data.improved?'최고 기록 등록 완료':'인게임 닉네임 갱신 · 기존 최고 기록 유지')+' · 현재 '+data.rank+'위 · 전투력 '+Number(data.score).toLocaleString('ko-KR',{maximumFractionDigits:2}):'현재 순위 1000+ · 상위 1,000위 밖 기록은 순위표에 표시하지 않습니다.');
 }catch(error){message(error.message);}finally{busy=false;controls();}
}
async function initialize(){
 if(catalog||initializing)return;initializing=true;
 try{
  message('랭킹 설정을 불러오는 중…');
  const response=await fetch('/ranking-catalog.json',{cache:'no-store'});if(!response.ok)throw Error('랭킹 설정을 불러올 수 없습니다.');
  catalog=await response.json();
  const snapshot=window.StackLabRanking.snapshot(),query=new URLSearchParams(location.search);
  const requested=catalog.targets.find(t=>t.id===query.get('target'));
  $('ranking-map').value=requested?.mode||snapshot.mode;
  targets(requested?.id||snapshot.target);
  if(['clara','goblin'].includes(query.get('deck')))$('ranking-deck').value=query.get('deck');
  else $('ranking-deck').value=R.presetFor(snapshot)||'clara';
  try{$('ranking-name').value=localStorage.getItem('stack-lab-ranking-name')||'';}catch{}
  $('ranking-form').hidden=false;
  for(const id of ['ranking-deck','ranking-map','ranking-target'])$(id).onchange=()=>{if(id==='ranking-map')targets();recordRevision=null;page=1;load();};
  $('ranking-prev').onclick=()=>{if(page>1){page--;load();}};
  $('ranking-next').onclick=()=>{if(page*50<total){page++;load();}};
  $('ranking-refresh').onclick=()=>load();$('ranking-form').onsubmit=submit;
  await load();
 }catch(error){catalog=null;message(error.message);}finally{initializing=false;}
}
if(panel.tagName==='DETAILS')panel.addEventListener('toggle',()=>{if(panel.open)initialize();});else initialize();
})();
