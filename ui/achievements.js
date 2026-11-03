(async()=>{
 const status=document.getElementById('achievement-status');
 const list=document.getElementById('achievement-list');
 try{
  const state=await fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
  let personal=!!state?.user;
  let response=await fetch('/api/me/achievements',personal?{method:'POST',headers:{
   'X-Account-Id':state.user.id,'X-CSRF-Token':state.csrf
  }}:{cache:'no-store'});
  if(!response.ok&&personal){personal=false;response=await fetch('/api/me/achievements',{cache:'no-store'});}
  if(!response.ok)throw Error('업적 목록을 불러오지 못했습니다.');
  const {badges}=await response.json();
  const count=badges.filter(badge=>badge.complete).length;
  status.textContent=personal?'달성 '+count+' / '+badges.length+'개 · '+Math.floor(100*count/badges.length)+'%':
   '로그인하면 내 진행률을 확인할 수 있습니다.';
  for(const badge of badges){
   const card=document.createElement('article');
   card.className='dashboard-panel achievement-card';
   const title=document.createElement('h2');
   title.append(badge.title,window.StackLabBadge.icon(badge.code,badge.title));
   const criterion=document.createElement('p');
   criterion.textContent=badge.criterion+' '+badge.target+'개';
   const reward=document.createElement('p');
   reward.textContent='보상 · '+badge.title+' 대표 배지';
   const progress=document.createElement('p');
   progress.textContent=personal?(badge.complete?'달성 완료 · 100%':badge.current+' / '+badge.target+' · '+badge.percent+'%'):'로그인 후 확인';
   card.append(title,criterion,reward,progress);
   if(personal){
    const meter=document.createElement('progress');
    meter.max=100;meter.value=badge.percent;
    meter.setAttribute('aria-label',badge.title+' 진행률');
    card.append(meter);
   }
   list.append(card);
  }
 }catch(error){status.textContent=error.message;}
})();
