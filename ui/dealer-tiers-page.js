(()=>{'use strict';
const $=s=>document.querySelector(s),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const gemMode=document.body?.dataset?.tierKind==='gems',subject=gemMode?'보석':'초마신',items=gemMode?CoopData.GEMS.map(g=>({...g,slug:g.id})):CoopData.demonsIn('supreme'),catalog=new Map(items.map(item=>[item.slug,item])),imagePath=slug=>gemMode?'/assets/gems/'+slug+'.webp':'/assets/units/'+catalog.get(slug).img+'.webp';
let latest=null,imageBlob=null,imageUrl=null,exporting=false,exportBackground='';
const exportBackgrounds=[['','기본'],['normal-full','일반'],['hard-full','어려움'],['hell-full','지옥'],['abyss-full','심연'],['deepsea-full','심해'],['tower','탑'],['wall','성벽']];
function syncBackgrounds(){const host=$('#vote-backgrounds');host.replaceChildren();for(const [id,label]of exportBackgrounds){const button=el('button',undefined,'vote-background-option');button.type='button';button.disabled=exporting;button.setAttribute('aria-pressed',String(exportBackground===id));button.setAttribute('aria-label',label+' 배경');if(id){const img=el('img');img.src='/assets/maps/'+id+'.webp';img.alt='';button.append(img);}else button.append(el('span','✦','vote-background-default'));button.append(el('b',label));button.onclick=()=>{exportBackground=id;exportVotes();};host.append(button);}}
let ko={},mine=null,busy=false,votingAllowed=true,loginRequired=false,voteAccount=null,draft=null,draftKey=null,savedDraft=null,storageNotice='';
const Worldcup=CoopWorldcup,slugs=items.map(item=>item.slug);
const name=slug=>{const d=catalog.get(slug);return ko[d?.name]||d?.name||slug;};
function portrait(slug){const img=el('img');img.src=imagePath(slug);img.alt=name(slug);img.draggable=false;return img;}
function restoreDraft(){
 draft=null;savedDraft=null;storageNotice='';
 if(!draftKey)return;
 try{
  savedDraft=localStorage.getItem(draftKey);
  if(savedDraft){const value=JSON.parse(savedDraft);Worldcup.replay(value,slugs);draft=value;}
 }catch{storageNotice='저장된 진행을 읽지 못했습니다. 새 월드컵을 시작해 주세요.';}
}
function saveDraft(next){
 if(!draftKey)return false;
 try{
  if(localStorage.getItem(draftKey)!==savedDraft){
   restoreDraft();$('#vote-status').textContent='다른 화면에서 진행이 바뀌어 최신 진행을 불러왔습니다.';sync();return false;
  }
  if(next){const serialized=JSON.stringify(next);localStorage.setItem(draftKey,serialized);savedDraft=serialized;}
  else{localStorage.removeItem(draftKey);savedDraft=null;}
 }catch{storageNotice='이 브라우저에 진행을 저장하지 못했습니다. 페이지를 닫으면 진행이 사라질 수 있습니다.';}
 draft=next;return true;
}
function showPlacements(result,host){
 const list=el('ol',undefined,'worldcup-results');
 for(const row of result.placements.filter(row=>row.points>0)){
  const item=el('li');item.append(portrait(row.slug),el('b',Worldcup.placeName(row.place)),el('span',name(row.slug)),el('small',row.points+'점'));list.append(item);
 }
 host.append(list);
}
function moveFinal(slug,index){
 if(busy||!votingAllowed||!draft)return;
 const result=Worldcup.replay(draft,slugs);
 if(!result.complete)return;
 const order=result.finalRanking.slice(),from=order.indexOf(slug);
 if(from<0||index<0||index>=order.length||index===from)return;
 order.splice(from,1);order.splice(index,0,slug);
 if(saveDraft({...draft,finalRanking:order})){
  sync();$('#vote-status').textContent=name(slug)+'을(를) '+(index+1)+'위로 옮겼습니다. 최종 순위를 확인한 뒤 제출하세요.';
  $('#worldcup-arena [data-worldcup-final="'+slug+'"] .worldcup-drag-handle')?.focus({preventScroll:true});
 }
}
function finalEditor(result,host){
 host.append(el('p','모든 순위가 정해졌습니다. 카드를 드래그하거나 앞·뒤 버튼으로 순서를 바꾼 뒤 제출하세요.'));
 const list=el('ol',undefined,'worldcup-final-list');
 for(const [index,slug]of result.finalRanking.entries()){
  const row=el('li');row.dataset.worldcupFinal=slug;row.draggable=!busy&&votingAllowed;
  const handle=el('button','↕','worldcup-drag-handle');handle.type='button';handle.disabled=busy||!votingAllowed;
  handle.setAttribute('aria-label',name(slug)+' 순위 끌어 이동');
  row.append(el('b',(index+1)+'위'),portrait(slug),el('strong',name(slug)),el('small',(slugs.length-index)+'점'),handle);
  const controls=el('div',undefined,'worldcup-order-controls');
  for(const [delta,label]of [[-1,'앞으로'],[1,'뒤로']]){
   const button=el('button',label);button.type='button';button.disabled=busy||!votingAllowed||index+delta<0||index+delta>=slugs.length;
   button.setAttribute('aria-label',name(slug)+' '+label);button.onclick=()=>moveFinal(slug,index+delta);controls.append(button);
  }
  row.append(controls);
  row.ondragstart=event=>{if(busy||!votingAllowed){event.preventDefault();return;}event.dataTransfer.setData('text/plain',slug);event.dataTransfer.effectAllowed='move';};
  row.ondragover=event=>{if(!busy&&votingAllowed)event.preventDefault();};
  row.ondrop=event=>{event.preventDefault();if(!busy&&votingAllowed)moveFinal(event.dataTransfer.getData('text/plain'),index);};
  let dragging=false,scrollFrame=null,point=null;
  const markTarget=()=>{
   const target=document.elementFromPoint(point.x,point.y)?.closest('[data-worldcup-final]');
   for(const item of list.children)item.classList.toggle('drag-over',item===target);
  };
  const scroll=()=>{
   if(!dragging)return;
   const step=point.y<80?-16:point.y>innerHeight-80?16:0;
   if(step)window.scrollBy({top:step,behavior:'instant'});
   markTarget();scrollFrame=requestAnimationFrame(scroll);
  };
  const clear=()=>{
   dragging=false;cancelAnimationFrame(scrollFrame);scrollFrame=null;row.classList.remove('dragging');
   for(const target of list.children)target.classList.remove('drag-over');
  };
  handle.onpointerdown=event=>{
   if(busy||!votingAllowed)return;
   window.scrollTo({top:window.scrollY,behavior:'instant'});
   event.preventDefault();dragging=true;point={x:event.clientX,y:event.clientY};
   handle.setPointerCapture(event.pointerId);row.classList.add('dragging');scrollFrame=requestAnimationFrame(scroll);
  };
  handle.onpointermove=event=>{
   if(!dragging)return;
   point={x:event.clientX,y:event.clientY};markTarget();
  };
  handle.onpointerup=event=>{
   if(!dragging)return;
   const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-worldcup-final]');
   const targetIndex=[...list.children].indexOf(target);
   clear();handle.releasePointerCapture(event.pointerId);
   if(targetIndex>=0)moveFinal(slug,targetIndex);
  };
  handle.onpointercancel=clear;
  handle.onlostpointercapture=clear;
  handle.onkeydown=event=>{
   if(['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();moveFinal(slug,index+(event.key==='ArrowUp'?-1:1));}
  };
  list.append(row);
 }
 host.append(list);
}
function sync(){
 const host=$('#worldcup-arena');host.replaceChildren();
 const result=draft?Worldcup.replay(draft,slugs):null;
 $('#worldcup-start').disabled=busy||!votingAllowed;
 $('#worldcup-start').textContent=!votingAllowed?(loginRequired?'로그인 후 시작하기':'현재 참여 제한'):draft?'처음부터 다시 시작':'새 월드컵 시작';
 $('#worldcup-undo').hidden=!draft;
 $('#worldcup-undo').disabled=busy||!votingAllowed||!draft?.picks.length;
 $('#vote-submit').hidden=!result?.complete;
 $('#vote-submit').disabled=busy||!votingAllowed||!result?.complete;
 $('#vote-submit').textContent=mine?'이 결과로 투표 교체하기':'이 결과로 투표하기';
 $('#vote-refresh').disabled=busy;
 $('#worldcup-progress').hidden=!draft;
 if(result){
  const placement=result.complete||result.next.phase==='placement';
  $('#worldcup-progress').max=placement?result.totalCount:result.mainMatches;
  $('#worldcup-progress').value=placement?result.rankedCount:result.played;
  if(result.complete){
   host.append(el('h3','최종 순위 확인 · 1위 '+name(result.champion)));
   finalEditor(result,host);
  }else{
   const match=result.next;
   host.append(el('h3',placement?match.from+'~'+match.to+'위 순위 결정전':Worldcup.roundName(match.round)+' · '+match.match+' / '+match.total+'경기'),
    el('p',(placement?'순위 확정 '+result.rankedCount+' / '+result.totalCount+'개 · 추가 결정전 '+(result.played-result.mainMatches)+'번 선택 완료':result.played+' / '+result.mainMatches+'번 본선 선택 완료')+' · 더 선호하는 '+subject+'을 골라 주세요.'));
   const choices=el('div',undefined,'worldcup-choices');
   for(const slug of [match.left,match.right]){
    const choice=el('button',undefined,'worldcup-choice');choice.type='button';choice.disabled=busy||!votingAllowed;
    choice.setAttribute('aria-label',name(slug)+' 선택');
    choice.append(portrait(slug),el('strong',name(slug)),el('span','선택하기'));
    choice.onclick=()=>{
     if(busy||!votingAllowed)return;
     const next={...draft,picks:[...draft.picks,slug]};
     if(saveDraft(next)){sync();$('#worldcup-arena h3')?.focus();}
    };
    choices.append(choice);
   }
   host.append(choices);
  }
 }else if(mine?.format===Worldcup.FORMAT){
  try{
   const saved=Worldcup.replay(mine,mine.seed.filter(slug=>slug!==null)),details=el('details');
   host.append(el('h3','등록한 1위 · '+name(saved.champion)));
   details.append(el('summary','전체 '+saved.totalCount+'위 결과 보기'));showPlacements(saved,details);host.append(details);
  }
  catch{host.append(el('p','새 월드컵으로 다시 참여할 수 있습니다.'));}
 }else{
  host.append(el('p',mine?'기존 순위 투표가 등록되어 있습니다. 새 월드컵을 제출하면 교체됩니다.':'두 후보 중 더 선호하는 쪽을 고르며 우승을 결정하세요.'));
 }
 if(storageNotice)host.append(el('p',storageNotice,'worldcup-notice'));
 const heading=host.querySelector('h3');if(heading)heading.tabIndex=-1;
}
$('#worldcup-start').onclick=async()=>{
 if(busy||!votingAllowed)return;
 if(window.StackLabAccess&&!await window.StackLabAccess.allow(gemMode?'gem-vote':'demon-vote'))return;
 if(draft&&!confirm('진행 중인 월드컵을 지우고 새 대진으로 시작할까요?'))return;
 if(saveDraft(Worldcup.create(slugs))){sync();$('#vote-status').textContent='월드컵을 시작했습니다. 선택할 때마다 진행이 자동 저장됩니다.';}
};
$('#worldcup-undo').onclick=()=>{
 if(busy||!votingAllowed||!draft?.picks.length)return;
 const {finalRanking,...rest}=draft;
 if(saveDraft({...rest,picks:draft.picks.slice(0,-1)}))sync();
};
function render(data){latest=data;$('#vote-image').disabled=false;mine=data.mine;$('#vote-total').textContent=`총 ${data.total.toLocaleString('ko-KR')}표 · 투표를 수정하면 기존 표를 대체합니다.`;const board=$('#dealer-tier-board');board.replaceChildren();if(!data.total)board.append(el('p','아직 투표가 없습니다. 첫 투표를 남겨 주세요.'));for(const tier of [...(data.rows.some(r=>r.tier==='0')?['0']:[]),'S','A','B','C','D','미득표']){const group=data.rows.filter(r=>r.tier===tier),row=el('section',undefined,'dealer-tier-row'+(tier==='0'?' tier-zero':tier==='S'?' tier-s':tier==='A'?' tier-a':'')),label=el('div',tier==='0'?'0 Tear':tier,'dealer-tier-label'),cards=el('div',undefined,'dealer-tier-cards');label.style.setProperty('--tier-color',({'0':'#ffdc73',S:'#d86f86',A:'#e5a64f',B:'#6e9bd2',C:'#7eae87',D:'#a49baa'})[tier]||'#aaa');for(const r of group){const card=el('article',undefined,'dealer-tier-card');card.append(portrait(r.slug),el('b',name(r.slug)),el('small',r.score+'점 · '+r.votes+'표'));cards.append(card);}if(!group.length)cards.append(el('span','해당 '+subject+' 없음','dealer-tier-empty'));row.append(label,cards);board.append(row);}}

async function load(write=false){
 if(busy)return;
 if(write&&window.StackLabAccess&&!await window.StackLabAccess.allow(gemMode?'gem-vote':'demon-vote'))return;
 if(busy)return;
 busy=true;sync();
 $('#vote-status').textContent=write?'월드컵 결과를 저장하는 중…':'결과를 불러오는 중…';
 try{
  const auth=await fetch('/api/auth/me',{cache:'no-store'});
  if(!auth.ok)throw Error('계정 상태를 확인하지 못했습니다.');
  const state=await auth.json(),account=state.user?.id||null;
  if(write&&account!==voteAccount)throw Error('로그인 계정이 변경되었습니다. 결과를 새로고침해 주세요.');
  if(write&&(!draft||!Worldcup.replay(draft,slugs).complete))throw Error('월드컵을 끝까지 진행해 주세요.');
  const headers=account?{'X-Account-Id':account,...(write?{'X-CSRF-Token':state.csrf}:{})}:{};
  const response=await fetch('/api/tier-votes'+(gemMode?'?kind=gems':''),write?{
   method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({ballot:draft})
  }:{cache:'no-store',headers});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'투표 서버에 연결할 수 없습니다.');
  const changed=voteAccount!==account;
  voteAccount=account;
  const key='stack-lab-worldcup-v1:'+(account||'guest')+':'+(gemMode?'gems':'demons');
  if(changed||draftKey!==key){draftKey=key;restoreDraft();}
  votingAllowed=data.canVote!==false;loginRequired=!!data.loginRequired;
  render(data);
  if(write)saveDraft(null);
  else if(!draft)restoreDraft();
  $('#vote-status').textContent=write?'월드컵 투표를 반영했습니다.':!votingAllowed?(loginRequired?'로그인 후 월드컵에 참여할 수 있습니다.':'현재 월드컵 참여가 제한되어 있습니다.'):draft?'이전에 진행하던 월드컵을 이어서 할 수 있습니다.':'월드컵을 시작하거나 등록한 결과를 확인하세요.';
 }catch(error){$('#vote-status').textContent=error.message;}
 finally{busy=false;sync();}
}
$('#tier-ballot').onsubmit=event=>{event.preventDefault();if(!$('#vote-submit').disabled)load(true);};
$('#vote-refresh').onclick=()=>load();
window.addEventListener('storage',event=>{
 if(event.key===draftKey&&!busy){restoreDraft();sync();$('#vote-status').textContent='다른 화면에서 변경된 월드컵 진행을 불러왔습니다.';}
});

async function exportVotes(){if(!latest||exporting)return;exporting=true;syncBackgrounds();$('#vote-share').disabled=true;$('#vote-download').hidden=true;$('#vote-image-open').hidden=true;$('#vote-share-status').textContent='선택한 배경으로 이미지를 만드는 중…';const background=exportBackground;const button=$('#vote-image');button.disabled=true;$('#vote-image-status').textContent='이미지를 만드는 중…';const data=structuredClone(latest);try{await document.fonts?.ready;const tiers=[...(data.rows.some(r=>r.tier==='0')?['0']:[]),'S','A','B','C','D','미득표'],groups=tiers.map(t=>data.rows.filter(r=>r.tier===t)),heights=groups.map(g=>Math.max(100,Math.ceil(g.length/8)*126+20)),canvas=document.createElement('canvas');canvas.width=1200;canvas.height=244+heights.reduce((a,b)=>a+b,0);const ctx=canvas.getContext('2d');if(!ctx)throw Error('이미지를 만들 수 없습니다.');const box=(x,y,w,h,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();};ctx.fillStyle='#0b1422';ctx.fillRect(0,0,1200,canvas.height);if(background){const map=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('맵 배경을 불러오지 못했습니다. 다시 선택해 주세요.'));img.src='/assets/maps/'+background+'.webp';});const scale=Math.max(1200/map.width,canvas.height/map.height),w=map.width*scale,h=map.height*scale;ctx.drawImage(map,(1200-w)/2,(canvas.height-h)/2,w,h);ctx.fillStyle='#08122299';ctx.fillRect(0,0,1200,canvas.height);}box(28,26,5,100,2,'#7de0c8');ctx.fillStyle='#7de0c8';ctx.font='bold 12px sans-serif';ctx.fillText('STACK LAB / COMMUNITY PICKS',50,40);ctx.fillStyle='#f0f5ff';ctx.font='bold 34px sans-serif';ctx.fillText(subject+' 투표 티어리스트',50,82);ctx.font='15px sans-serif';ctx.fillStyle='#a4b8d1';ctx.fillText('월드컵으로 고른 선호도, 한눈에 보는 '+subject+' 티어',50,113);box(920,38,252,64,14,'#192b3d');ctx.textAlign='center';ctx.fillStyle='#e3f4ee';ctx.font='bold 21px sans-serif';ctx.fillText('총 '+data.total.toLocaleString('ko-KR')+'표',1046,66,224);ctx.fillStyle='#9eb7cb';ctx.font='12px sans-serif';ctx.fillText(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date())+' · 집계 기준',1046,87);ctx.textAlign='left';ctx.fillStyle='#91a9bf';ctx.font='12px sans-serif';ctx.fillText('0 Tear: 득표 상위 1/5 내 최대 격차(20% 이상)로 그룹 분리  /  S~D: 남은 최고점 기준',50,146);let y=174;for(let i=0;i<tiers.length;i++){const tier=tiers[i],height=heights[i];const color=({'0':'#ffdc73',S:'#e68ba3',A:'#e4b074',B:'#7ca7d6',C:'#8cb69a',D:'#a6a3bc'})[tier]||'#70869d';box(28,y,1144,height-8,16,tier==='0'?(background?'#3c3421c9':'#3c3421'):(background?'#1a293bc4':'#1a293b'));box(28,y,100,height-8,16,color);ctx.textAlign='center';ctx.fillStyle=tier==='0'?'#513807':'#fff';ctx.font='bold 22px sans-serif';ctx.fillText(tier==='0'?'0 Tear':tier,78,y+height/2-2);ctx.font='11px sans-serif';ctx.fillText(groups[i].length+'종',78,y+height/2+20);const images=await Promise.all(groups[i].map(r=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=imagePath(r.slug);})));groups[i].forEach((r,j)=>{const x=140+(j%8)*126,top=y+10+Math.floor(j/8)*126,img=images[j];box(x+4,top-2,118,118,11,tier==='0'?'#51452b':'#223449');if(tier==='0'||tier==='S'){const accent=tier==='0'?'#ffe398':'#ed9bb6';ctx.save();ctx.strokeStyle=accent;ctx.lineWidth=1.5;ctx.shadowColor=accent+'88';ctx.shadowBlur=12;ctx.beginPath();ctx.roundRect(x+4,top-2,118,118,11);ctx.stroke();ctx.fillStyle=accent+'2e';ctx.shadowBlur=20;ctx.beginPath();ctx.arc(x+63,top+34,30,0,Math.PI*2);ctx.fill();ctx.restore();}if(['0','S','A'].includes(tier)){ctx.fillStyle=tier==='0'?'#fff0a8':tier==='S'?'#f1b7c8':'#dfbf96';ctx.font=(tier==='0'?'18':tier==='S'?'13':'10')+'px sans-serif';ctx.fillText('✦',x+108,top+17);if(tier==='0'){ctx.font='11px sans-serif';ctx.fillText('✧',x+19,top+48);}}if(img){const scale=Math.min(68/img.width,68/img.height);ctx.save();if(tier==='0'||tier==='S'){ctx.shadowColor=tier==='0'?'#ffe398aa':'#ed9bb6aa';ctx.shadowBlur=9;}ctx.drawImage(img,x+(126-img.width*scale)/2,top,img.width*scale,img.height*scale);ctx.restore();}ctx.fillStyle='#fff';ctx.font='14px sans-serif';ctx.fillText(name(r.slug),x+63,top+87,118);ctx.fillStyle='#b9c9dd';ctx.font='12px sans-serif';ctx.fillText(r.score+'점 · '+r.votes+'표',x+63,top+108,118);});if(!groups[i].length){ctx.fillStyle='#aabbd0';ctx.font='16px sans-serif';ctx.fillText('해당 '+subject+' 없음',640,y+50);}y+=height;}ctx.textAlign='left';ctx.fillStyle='#8299b1';ctx.font='12px sans-serif';ctx.fillText('STACK LAB · '+subject+' 커뮤니티 선호도 투표',28,canvas.height-24);ctx.textAlign='right';ctx.fillStyle='#7de0c8';ctx.fillText('WORLD CUP / FINAL RANKS',1172,canvas.height-24);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG 생성 실패');if(imageUrl)URL.revokeObjectURL(imageUrl);imageBlob=blob;imageUrl=URL.createObjectURL(blob);$('#vote-preview').src=imageUrl;$('#vote-download').href=imageUrl;$('#vote-image-open').href=imageUrl;let share=false;try{share=!!navigator.canShare?.({files:[new File([blob],'community-tier-list.png',{type:'image/png'})]});}catch{}$('#vote-share').hidden=!share;$('#vote-share-status').textContent='이미지를 길게 눌러 사진에 저장하거나 아래 버튼을 이용하세요.';if(!$('#vote-export').open)$('#vote-export').showModal();$('#vote-image-status').textContent='이미지를 만들었습니다.';}catch(error){$('#vote-image-status').textContent='이미지 저장 실패: '+error.message;$('#vote-share-status').textContent=error.message;}finally{button.disabled=false;exporting=false;syncBackgrounds();$('#vote-share').disabled=false;$('#vote-download').hidden=!imageBlob;$('#vote-image-open').hidden=!imageBlob;}}
syncBackgrounds();$('#vote-image').onclick=exportVotes;$('#vote-export-close').onclick=()=>$('#vote-export').close();$('#vote-share').onclick=async()=>{if(!imageBlob)return;try{await navigator.share({files:[new File([imageBlob],'community-tier-list.png',{type:'image/png'})],title:subject+' 투표 티어리스트'});}catch(error){$('#vote-share-status').textContent=error.name==='AbortError'?'공유를 취소했습니다. 파일 저장이나 이미지 길게 누르기를 이용하세요.':'파일 저장이나 이미지 크게 열기를 이용하세요.';}};
fetch('/ko.json').then(r=>r.json()).then(d=>ko=d).catch(()=>{}).finally(()=>{sync();load();});
})();
