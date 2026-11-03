(() => {
 const marker=document.getElementById('archive-marker');
 const visit=location.pathname==='/guide/'?'roadmap':null;
 if(!marker&&!visit)return;
 const status=document.getElementById('archive-discovery-status');
 async function discover(){
  if(marker)marker.disabled=true;
  try{
   const session=await fetch('/api/auth/me',{cache:'no-store'});
   if(!session.ok)throw Error('계정 상태를 확인하지 못했습니다.');
   const {user,csrf}=await session.json();
   if(!user||!csrf){if(visit)return;throw Error('발견을 기록하려면 로그인해 주세요.');}
   const response=await fetch('/api/me/archive-discovery'+(visit||marker.dataset.spot?'?spot='+encodeURIComponent(visit||marker.dataset.spot):''),{method:'POST',headers:{
    'X-Account-Id':user.id,'X-CSRF-Token':csrf
   }});
   const result=await response.json();
   if(!response.ok)throw Error(result.error);
   if(result.earned)status.textContent='히든 업적 획득 · '+(result.title||'기록의 틈새');
   else if(marker)status.textContent='이미 기록한 발견입니다.';
  }catch(error){if(marker)status.textContent=error.message;}
  finally{if(marker)marker.disabled=false;}
 }
 if(visit)discover();
 else marker.addEventListener('click',discover);
})();
