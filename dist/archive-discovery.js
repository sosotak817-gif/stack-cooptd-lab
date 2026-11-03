(() => {
 const marker=document.getElementById('archive-marker');
 if(!marker)return;
 const status=document.getElementById('archive-discovery-status');
 marker.addEventListener('click',async()=>{
  marker.disabled=true;
  try{
   const session=await fetch('/api/auth/me',{cache:'no-store'});
   if(!session.ok)throw Error('계정 상태를 확인하지 못했습니다.');
   const {user,csrf}=await session.json();
   if(!user||!csrf)throw Error('발견을 기록하려면 로그인해 주세요.');
   const response=await fetch('/api/me/archive-discovery',{method:'POST',headers:{
    'X-Account-Id':user.id,'X-CSRF-Token':csrf
   }});
   const result=await response.json();
   if(!response.ok)throw Error(result.error);
   status.textContent=result.earned?'히든 업적 획득 · 기록의 틈새':'이미 기록한 발견입니다.';
  }catch(error){status.textContent=error.message;}
  finally{marker.disabled=false;}
 });
})();
