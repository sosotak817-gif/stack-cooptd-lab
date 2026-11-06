(()=>{
 let dialog,pageDenied=false;
 function notice(feature,hard=false){
  pageDenied=hard;
  if(!dialog){
   dialog=document.createElement('dialog');
   dialog.style.cssText='max-width:28rem;width:calc(100% - 3rem);box-sizing:border-box;border:1px solid #45627a;border-radius:14px;padding:1.5rem;background:#142437;color:#e8f2ff';
   dialog.addEventListener('cancel',event=>{if(pageDenied)event.preventDefault();});
   document.body.append(dialog);
  }
  const heading=document.createElement('h2'),message=document.createElement('p'),links=document.createElement('p');
  heading.textContent='이용 조건 안내';
  message.textContent=feature?.loginRequired?'로그인 후 이용할 수 있는 기능입니다.':feature?.label?'현재 로그인 상태에서는 '+feature.label+' 기능을 이용할 수 없습니다.':'접근 조건을 확인하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.';
  for(const [label,path]of [['로그인·계정','/account/'],['대시보드','/']]){
   const link=document.createElement('a');link.href=path;link.target='_top';link.textContent=label;link.style.cssText='display:inline-block;margin-right:1rem;color:#8cf3d9';links.append(link);
  }
  dialog.replaceChildren(heading,message,links);
  if(!hard){
   const close=document.createElement('button');close.type='button';close.textContent='닫기';close.onclick=()=>dialog.close();dialog.append(close);
  }
  if(!dialog.open)dialog.showModal();
 }
 async function refresh(){
  try{
   const response=await fetch('/api/feature-access?path='+encodeURIComponent(location.pathname),{cache:'no-store'});
   if(!response.ok)return null;
   const state=await response.json();
   if(state.page&&!state.page.allowed)notice(state.page,true);
   else if(pageDenied){pageDenied=false;dialog?.close();}
   return state;
  }catch{return null;}
 }
 window.StackLabAccess={
  refresh,
  async allow(id){
   const state=await refresh(),feature=state?.features.find(feature=>feature.id===id);
   if(state?.page&&!state.page.allowed)return false;
   if(feature?.allowed)return true;
   notice(feature);return false;
  }
 };
 if(!location.pathname.startsWith('/admin')){
  refresh();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 }
})();
