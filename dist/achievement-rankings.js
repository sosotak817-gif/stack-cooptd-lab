(async()=>{
 const status=document.getElementById('achievement-ranking-status');
 const list=document.getElementById('achievement-ranking-rows');
 try{
  const response=await fetch('/api/achievement-rankings',{cache:'no-store'});
  const {rows,error}=await response.json();
  if(!response.ok)throw Error(error);
  let rank=0,previousTotal=null;
  for(const [index,row] of rows.entries()){
   if(row.total!==previousTotal)rank=index+1;
   previousTotal=row.total;
   const entry=list.insertRow();
   entry.insertCell().textContent=rank;
   const name=document.createElement('span');
   name.className='lab-ranked-name';
   name.textContent=row.nickname;
   if(row.badgeCode&&window.StackLabBadge)name.append(window.StackLabBadge.icon(row.badgeCode,row.badgeTitle));
   entry.insertCell().append(name);
   for(const value of [row.general,row.hidden,row.total])entry.insertCell().textContent=value;
  }
  status.textContent=rows.length?'상위 '+rows.length+'명 · 합계가 같으면 공동 순위':'아직 집계된 업적이 없습니다.';
 }catch(error){status.textContent=error.message||'업적 랭킹을 불러오지 못했습니다.';}
})();
