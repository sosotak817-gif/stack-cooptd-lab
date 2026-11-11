(function(root){
 'use strict';
 function koreanDate(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const value=type=>parts.find(part=>part.type===type).value;
  return value('year').padStart(4,'0')+'-'+value('month')+'-'+value('day');
 }
 function validDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000'))return false;
  const date=new Date(value+'T00:00:00Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
 }
 const readings=[
  ['반짝이는 기운','작은 기대가 빛나는 날','평소라면 지나쳤을 작은 즐거움이 눈에 들어오는 날이에요. 오늘의 반짝임을 천천히 발견해 보세요.'],
  ['느긋한 행운','서두르지 않아도 괜찮아요','오늘의 행운은 느긋한 쪽을 좋아하나 봐요. 숨 한 번 고르고, 편안한 마음으로 오늘을 즐겨 보세요.'],
  ['뜻밖의 즐거움','예상 밖의 순간에 웃음이','딱 바라던 모습과 조금 달라도 즐거운 순간은 찾아와요. 오늘은 뜻밖의 발견에 별 하나를 붙여 주세요.'],
  ['포근한 기운','익숙한 것에서 찾은 보물','늘 곁에 있던 것의 매력을 다시 발견할지도 몰라요. 좋아하는 캐릭터와 함께하는 시간이 오늘의 작은 보물이에요.'],
  ['장난스러운 기운','보석 요정이 장난치는 날','오늘의 보석 요정은 유난히 장난기가 많아요. 결과가 어떻든 웃을 준비를 해 두면 이미 요정에게 한 수 앞선 거예요.'],
  ['산뜻한 행운','오늘의 주인공은 당신','작은 선택 하나에도 자신만의 취향이 반짝이는 날이에요. 오늘 마음에 드는 색을 하나 골라 곁에 두세요.'],
  ['쉬어 가는 기운','잠깐의 여유가 주는 선물','반짝이는 보석도 쉬는 시간이 필요하대요. 잠깐 눈을 쉬게 하고 돌아오면 익숙한 화면도 새롭게 보일 거예요.'],
  ['함께하는 행운','나누면 더 반짝이는 이야기','친구에게 건넨 한마디가 즐거운 대화로 돌아올 수 있어요. 오늘의 소소한 순간을 누군가와 나눠 보세요.'],
  ['맑은 기운','가벼운 마음으로 시작해요','복잡한 생각은 잠시 내려두고, 오늘의 작은 재미 하나를 찾아보세요. 기분 좋은 시작만으로도 충분한 날이에요.'],
  ['호기심의 기운','새로운 취향을 발견할지도','평소 눈여겨보지 않던 색이나 모양에 마음이 갈 수 있어요. 오늘은 무엇이 예뻐 보이는지 한 번 들여다보세요.'],
  ['차분한 행운','작은 반짝임도 오래도록','화려한 순간보다 오래 기억할 작은 즐거움이 기다리는 날이에요. 마음에 드는 장면을 하나 간직해 보세요.'],
  ['응원의 기운','당신의 하루에 반짝임 한 줌','오늘 할 일을 하나 끝냈다면 스스로에게 작은 박수를 보내 주세요. 보석 요정도 옆에서 조용히 응원하고 있어요.']
 ];
 const gems=[['fortune','행운'],['focus','집중'],['awakening','각성'],['bounty','현상금'],['cycle','순환'],['agility','민첩']];
 const colors=['민트','라벤더','하늘색','코랄','금빛','진주빛','연두','장밋빛'];
 const rituals=['오늘의 작은 의식 · 어깨를 쭉 펴고 기지개 한 번.','오늘의 작은 의식 · 물 한 모금으로 산뜻하게.','오늘의 작은 의식 · 좋아하는 노래 한 곡 듣기.','오늘의 작은 의식 · 창밖을 보며 눈 잠깐 쉬기.','오늘의 작은 의식 · 친구에게 행운의 이모지 보내기.','오늘의 작은 의식 · 오늘 잘한 일 하나 떠올리기.'];
 function fortune(birth,day=koreanDate()){
  if(!validDate(day)||!validDate(birth)||birth>day)throw Error('오늘 이전의 올바른 생년월일을 입력해 주세요.');
  let seed=2166136261;
  for(const char of 'stack-lab-fortune-v1|'+birth+'|'+day){
   seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
  }
  const pick=length=>{
   seed=(seed+0x6D2B79F5)>>>0;
   let value=Math.imul(seed^(seed>>>15),1|seed);
   value^=value+Math.imul(value^(value>>>7),61|value);
   return ((value^(value>>>14))>>>0)%length;
  };
  const [mood,title,message]=readings[pick(readings.length)];
  const [gem,gemName]=gems[pick(gems.length)];
  return {day,mood,title,message,gem,gemName,color:colors[pick(colors.length)],number:pick(9)+1,ritual:rituals[pick(rituals.length)]};
 }
 root.CoopFortune={koreanDate,fortune};
 if(typeof module!=='undefined')module.exports=root.CoopFortune;
 if(typeof document==='undefined')return;
 const form=document.getElementById('fortune-form'),birth=document.getElementById('fortune-birth');
 const result=document.getElementById('fortune-result'),button=document.getElementById('fortune-submit');
 const status=document.getElementById('fortune-status'),stage=document.querySelector('.fortune-stage');
 let day=koreanDate(),timer=null;
 function reset(){
  clearTimeout(timer);
  timer=null;
  result.hidden=true;
  button.disabled=false;
  stage.dataset.reading='false';
  status.textContent='';
 }
 function syncDay(){
  const today=koreanDate();
  if(day!==today){
   reset();
   day=today;
   status.textContent='새로운 하루가 시작됐어요. 오늘의 운세를 펼쳐 보세요.';
  }
  birth.max=day;
  document.getElementById('fortune-date').textContent=day.replaceAll('-','. ')+' · 한국 시간';
 }
 birth.addEventListener('input',()=>{
  birth.setCustomValidity('');
  reset();
 });
 form.addEventListener('submit',event=>{
  event.preventDefault();
  syncDay();
  let reading;
  try{reading=fortune(birth.value,day);}
  catch(error){
   birth.setCustomValidity(error.message);
   birth.reportValidity();
   return;
  }
  reset();
  button.disabled=true;
  stage.dataset.reading='true';
  status.textContent='오늘의 보석에 빛을 담고 있어요…';
  timer=setTimeout(()=>{
   if(reading.day!==koreanDate()){syncDay();return;}
   for(const key of ['mood','title','message','color','number','ritual']){
    document.getElementById('fortune-'+key).textContent=String(reading[key]);
   }
   document.getElementById('fortune-gem').textContent=reading.gemName;
   document.querySelector('.fortune-jewel img+img').src='/assets/gems/'+reading.gem+'.webp';
   result.hidden=false;
   stage.dataset.reading='false';
   button.disabled=false;
   status.textContent='오늘의 운세가 도착했어요.';
   document.getElementById('fortune-title').focus({preventScroll:true});
   result.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});
  },650);
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncDay();});
 setInterval(syncDay,60000);
 syncDay();
})(globalThis);
