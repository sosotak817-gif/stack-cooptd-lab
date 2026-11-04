(async()=>{
 const $=id=>document.getElementById(id);
 let session,busy=false,voteOffset=0,voteRequest=0,dictionary={};
 async function api(method='GET',body,query='') {
  const response=await fetch('/api/admin'+query,{method,cache:'no-store',headers:{
   'X-Account-Id':session.user.id,...(method==='POST'?{'X-CSRF-Token':session.csrf,'Content-Type':'application/json'}:{})
  },...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();
  if(!response.ok)throw Error(result.error);
  return result;
 }
 async function run(body){
  if(busy)return;
  busy=true;
  $('admin-run').disabled=true;
  $('admin-status').textContent='처리 중…';
  try {
   const result=await api('POST',body);
   $('admin-result').textContent=JSON.stringify(result,null,2);
   $('admin-status').textContent=result.message||'완료 · 변경 '+result.changes+'건';
   return result;
  }catch(error){$('admin-status').textContent=error.message;}
  finally{busy=false;$('admin-run').disabled=false;}
 }
 async function loadVotes(){
  const token=++voteRequest,kind=$('admin-vote-kind').value;
  $('admin-vote-list').replaceChildren();
  $('admin-vote-status').textContent='투표 목록을 불러오는 중…';
  $('admin-vote-prev').disabled=$('admin-vote-next').disabled=true;
  try{
   const data=await api('GET',undefined,'?view=votes&kind='+kind+'&offset='+voteOffset);
   if(token!==voteRequest)return;
   if(voteOffset>=data.total&&voteOffset>0){voteOffset=Math.max(0,Math.floor((data.total-1)/50)*50);return loadVotes();}
   $('admin-vote-status').textContent='총 '+data.total+'표'+(data.total?' · '+(voteOffset+1)+'~'+(voteOffset+data.votes.length)+'번째':' · 등록된 투표가 없습니다.');
   $('admin-vote-prev').disabled=voteOffset===0;
   $('admin-vote-next').disabled=voteOffset+data.votes.length>=data.total;
   for(const vote of data.votes){
    const row=document.createElement('tr'),who=document.createElement('td'),ranking=document.createElement('td'),date=document.createElement('td'),actions=document.createElement('td');
    who.textContent=vote.nickname;
    if(vote.voter.startsWith('account:')){
     const account=document.createElement('small');
     account.style.cssText='display:block;overflow-wrap:anywhere';
     account.textContent=vote.voter.slice(8);who.append(account);
    }
    const list=document.createElement('ol');
    list.style.cssText='display:flex;flex-wrap:wrap;gap:.75rem;padding:0;list-style:none;min-width:18rem';
    for(const [index,id]of vote.ranking.entries()){
     const entry=kind==='gems'?CoopData.GEM_BY_ID.get(id):CoopData.DEMON_BY_SLUG.get(id);
     const item=document.createElement('li');
     item.style.cssText='display:flex;align-items:center;gap:.25rem';
     if(entry){const image=document.createElement('img');image.src=kind==='gems'?'/assets/gems/'+id+'.webp':'/assets/units/'+entry.img+'.webp';image.width=image.height=28;image.alt='';item.append(image);}
     item.append((index+1)+'위 '+(dictionary[entry?.name]||entry?.name||id));list.append(item);
    }
    ranking.append(list);
    if(!vote.ranking.length)ranking.textContent='순위를 읽지 못했습니다.';
    date.textContent=Number.isFinite(vote.updatedAt)?new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Seoul'}).format(new Date(vote.updatedAt)):'시간 정보 없음';
    const remove=document.createElement('button');remove.type='button';remove.textContent='삭제';
    remove.setAttribute('aria-label',vote.nickname+' 투표 삭제');
    remove.onclick=async()=>{
     if(busy||!confirm(vote.nickname+'의 '+(kind==='gems'?'보석':'초마신')+' 투표를 삭제할까요?'))return;
     remove.disabled=true;
     const result=await run({action:'delete-vote',kind,voter:vote.voter,updatedAt:vote.updatedAt});
     if(result)await loadVotes();
     else{$('admin-vote-status').textContent=$('admin-status').textContent;remove.disabled=false;}
    };
    actions.append(remove);row.append(who,ranking,date,actions);$('admin-vote-list').append(row);
   }
  }catch(error){if(token===voteRequest)$('admin-vote-status').textContent=error.message;}
 }
 try {
  const response=await fetch('/api/auth/me',{cache:'no-store'});
  session=await response.json();
  if(!session.user)throw Error('로그인 후 이용해 주세요.');
  const state=await api();
  for(const name of state.tables){
   const option=document.createElement('option');option.value=option.textContent=name;$('admin-table').append(option);
  }
  $('admin-content').hidden=false;
  $('admin-access').hidden=true;
  dictionary=await fetch('/ko.json').then(response=>response.json()).catch(()=>({}));
  $('admin-vote-kind').onchange=()=>{voteOffset=0;loadVotes();};
  $('admin-vote-refresh').onclick=()=>loadVotes();
  $('admin-vote-prev').onclick=()=>{voteOffset=Math.max(0,voteOffset-50);loadVotes();};
  $('admin-vote-next').onclick=()=>{voteOffset+=50;loadVotes();};
  loadVotes();
  for(const button of document.querySelectorAll('[data-reset]'))button.onclick=()=>{
   if(confirm(button.textContent+'를 실행할까요? 기존 투표가 삭제됩니다.'))run({action:'reset-votes',kind:button.dataset.reset}).then(result=>{if(result)loadVotes();});
  };
  $('admin-inspect').onclick=()=>{
   const table=$('admin-table').value;
   if(!state.tables.includes(table))return;
   $('admin-sql').value='SELECT * FROM "'+table.replaceAll('"','""')+'" LIMIT 100';
   run({action:'sql',sql:$('admin-sql').value});
  };
  $('admin-sql-form').onsubmit=event=>{
   event.preventDefault();
   const sql=$('admin-sql').value.trim();
   if(!/^SELECT\b/i.test(sql)&&!$('admin-write').checked){$('admin-status').textContent='데이터 변경 SQL 실행 허용을 선택하세요.';return;}
   if(!/^SELECT\b/i.test(sql)&&!confirm('SQL을 실행해 데이터를 변경할까요?'))return;
   run({action:'sql',sql});
  };
 }catch(error){$('admin-access').textContent=error.message;}
})();
