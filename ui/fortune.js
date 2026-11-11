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
 const grades=[
  {
   grade:'SSS',luck:'대길',choice:'draw',color:'#ff818d',verdict:'오늘은 봉인을 열어볼 때',
   readings:[
    ['상자 밖으로 새어 나오는 빛','보석 요정이 먼저 문을 두드려요','오늘은 요정이 상자 앞에서 발을 동동 구르고 있어요. 준비해 둔 오늘 몫이 있다면 펼쳐보고 싶은 기운이에요. 정해 둔 횟수 안에서, 어떤 보석을 만날지 설레는 순간을 즐겨 보세요.'],
    ['유난히 반짝이는 기운','오늘의 상자에 시선 집중','상자 틈으로 빛이 새어 나와 눈을 뗄 수가 없네요. 오늘 뽑을지 망설였다면 요정은 오늘 쪽에 한 표를 던졌어요. 오늘 몫으로 정해 둔 상자를 천천히 열어볼까요?'],
    ['요정의 초대장','기다리던 순간을 펼쳐볼까요?','보석 요정이 당신 이름이 적힌 초대장을 내밀었어요. 오늘은 준비해 둔 뽑기를 열어보는 쪽으로 마음이 기우네요. 정한 만큼 즐긴 뒤에는 오늘의 만남을 기억해 주세요.']
   ]
  },
  {
   grade:'SS',luck:'길',choice:'draw',color:'#ffdb78',verdict:'오늘 몫만 가볍게 열어보기',
   readings:[
    ['손끝에 머무는 반짝임','작은 기대를 열어봐도 좋겠어요','상자 위에 금빛 가루가 살짝 내려앉았네요. 오늘은 정해 둔 만큼 가볍게 열어보고 싶은 날이에요. 커다란 기대보다 어떤 보석을 만날지 궁금해하는 마음이 잘 어울려요.'],
    ['살며시 열린 문','오늘은 한 번 인사해 볼까요?','보석 요정이 문틈으로 손을 흔들고 있어요. 준비한 오늘 몫이 있다면 가볍게 인사하러 가도 좋겠네요. 미리 정한 횟수를 지키며 오늘의 이야기를 만들어 보세요.'],
    ['기분 좋은 예감','기대를 조금 꺼내볼 때','상자를 보고 있자니 왠지 입꼬리가 올라가네요. 오늘의 요정은 살짝 호의적인 표정이에요. 정해 둔 오늘 몫 안에서 작은 설렘을 펼쳐보는 건 어때요?']
   ]
  },
  {
   grade:'S',luck:'보통',choice:'small',color:'#d2a0ff',verdict:'소량만 열고 마음 가는 대로',
   readings:[
    ['반은 기대, 반은 망설임','요정도 동전을 굴리는 중','오늘은 열까 말까, 요정도 쉽게 결정을 못 하겠대요. 궁금하다면 미리 정한 소량만 열어보고, 마음이 내키지 않으면 내일로 넘겨도 좋은 분위기예요.'],
    ['잔잔한 보석의 기운','오늘의 선택은 반반','상자도 요정도 오늘은 조용하네요. 특별히 서두를 신호는 없지만 조금 맛보는 재미는 있겠어요. 소량만 가볍게 열지, 그대로 남길지 취향대로 골라보세요.'],
    ['문턱에 앉은 요정','조금 열고 여운 남기기','요정이 문턱에 앉아 다리를 흔들고 있어요. 오늘은 큰 결심보다 작은 호기심에 어울리는 날. 궁금한 만큼 미리 정한 소량만, 나머지 기대는 다음 이야기로 남겨 둬요.']
   ]
  },
  {
   grade:'A',luck:'흉',choice:'wait',color:'#80b1ff',verdict:'오늘은 상자를 아껴두기',
   readings:[
    ['안개에 가려진 상자','오늘은 관망하는 쪽에 한 표','상자 앞에 안개가 자욱해서 마음까지 오락가락하네요. 오늘은 버튼에서 한 발 물러나 상자를 아껴두는 쪽이 어울려요. 내일은 어떤 기운이 오는지 다시 확인해 볼까요?'],
    ['느린 행운의 걸음','하루 더 기다려볼까요?','오늘의 보석 요정은 약속 시간보다 느긋하게 걸어오고 있어요. 지금 문을 두드리기보다는 기대를 하루 더 품고 싶네요. 내일의 운세를 보고 다시 결정해도 좋아요.'],
    ['닫혀 있는 보석의 문','내일의 나에게 넘겨볼까요?','문고리를 돌려봐도 요정이 대답을 망설이네요. 오늘은 서둘러 상자를 열기보다 잠시 내려두고 싶은 기운이에요. 내일의 나에게 결정권을 넘겨보는 건 어때요?']
   ]
  },
  {
   grade:'B',luck:'대흉',choice:'wait',color:'#acf479',verdict:'오늘은 쉬고 내일 다시 보기',
   readings:[
    ['보석 요정 휴무일','상자에 휴무 안내문이 붙었어요','오늘의 요정은 이불 속에서 나올 생각이 없대요. 상자에도 큼지막하게 휴무 안내문을 붙여 뒀네요. 오늘은 뽑기를 쉬어가고, 내일 요정이 출근했는지 다시 확인해 봐요.'],
    ['깊이 잠든 보석','두드려도 코 고는 소리만','상자 안에서 반짝임 대신 새근새근 코 고는 소리가 들려요. 오늘은 깨우려고 애쓰기보다 그대로 재워두고 싶은 날이에요. 상자는 아껴 두고 내일의 기운을 만나러 와요.'],
    ['요정의 자리 비움','오늘은 버튼과 잠시 거리 두기','요정이 상자 열쇠를 베개 밑에 두고 산책을 나갔대요. 오늘만큼은 버튼과 눈을 마주치지 않는 쪽에 한 표. 내일은 어떤 표정으로 돌아올지 다시 만나봐요.']
   ]
  }
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
  const grade=grades[pick(grades.length)];
  const [mood,title,message]=grade.readings[pick(grade.readings.length)];
  const [gem,gemName]=gems[pick(gems.length)];
  return {day,mood,title,message,grade:grade.grade,luck:grade.luck,choice:grade.choice,verdict:grade.verdict,accent:grade.color,gem,gemName,color:colors[pick(colors.length)],number:pick(9)+1,ritual:rituals[pick(rituals.length)]};
 }
 root.CoopFortune={koreanDate,fortune};
 if(typeof module!=='undefined')module.exports=root.CoopFortune;
 if(typeof document==='undefined')return;
 const form=document.getElementById('fortune-form'),birth=document.getElementById('fortune-birth');
 const result=document.getElementById('fortune-result'),button=document.getElementById('fortune-submit');
 const status=document.getElementById('fortune-status'),stage=document.querySelector('.fortune-stage');
 let day=koreanDate(),timer=null;
 const birthdayKey='stack-lab-fortune-birthday-v1';
 function rememberBirthday(){
  try{
   if(!birth.value)localStorage.removeItem(birthdayKey);
   else if(validDate(birth.value)&&birth.value<=koreanDate())localStorage.setItem(birthdayKey,birth.value);
  }catch{
   document.getElementById('fortune-birth-help').textContent='브라우저 저장 공간을 사용할 수 없어 생년월일을 기억하지 못해요. 현재 입력으로 운세를 볼 수 있어요.';
  }
 }

 function reset(){
  root.CoopFortuneExport.reset();
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
  rememberBirthday();
  reset();
 });
 birth.addEventListener('change',rememberBirthday);
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
  rememberBirthday();
  reset();
  button.disabled=true;
  stage.dataset.reading='true';
  status.textContent='오늘의 보석에 빛을 담고 있어요…';
  timer=setTimeout(()=>{
   if(reading.day!==koreanDate()){syncDay();return;}
   result.dataset.choice=reading.choice;
   result.dataset.grade=reading.grade.toLowerCase();
   result.style.setProperty('--fortune-accent',reading.accent);
   stage.style.setProperty('--fortune-accent',reading.accent);
   document.getElementById('fortune-grade').textContent=reading.grade+' 보석의 기운';
   document.getElementById('fortune-luck').textContent=reading.luck;
   for(const image of document.querySelectorAll('[data-fortune-stone]')){
    image.src='/assets/gems/stone-'+reading.grade.toLowerCase()+'.webp';
   }
   for(const image of document.querySelectorAll('[data-fortune-glyph]')){
    image.src='/assets/gems/'+reading.gem+'.webp';
   }
   for(const key of ['verdict','mood','title','message','color','number','ritual']){
    document.getElementById('fortune-'+key).textContent=String(reading[key]);
   }
   document.getElementById('fortune-gem').textContent=reading.gemName;
   result.hidden=false;
   stage.dataset.reading='false';
   button.disabled=false;
   status.textContent='오늘의 운세가 도착했어요.';
   root.CoopFortuneExport.prepare(reading);
   document.getElementById('fortune-title').focus({preventScroll:true});
   result.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});
  },650);
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncDay();});
 setInterval(syncDay,60000);
 syncDay();
 try{
  const savedBirthday=localStorage.getItem(birthdayKey);
  if(savedBirthday){
   if(validDate(savedBirthday)&&savedBirthday<=day)birth.value=savedBirthday;
   else localStorage.removeItem(birthdayKey);
  }
 }catch{
  document.getElementById('fortune-birth-help').textContent='브라우저 저장 공간을 사용할 수 없어 생년월일을 기억하지 못해요. 직접 입력해 운세를 볼 수 있어요.';
 }
})(globalThis);
