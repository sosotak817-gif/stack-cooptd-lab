(()=>{
 'use strict';
 const key='stack-lab-site-theme-v1',channel='stack-lab-site-theme-v1';
 const themes=[
  {
    "id": "ice-knight",
    "name": "빙결 기사",
    "description": "청록의 서리 · 짙은 남색",
    "hue": 205,
    "accent": "#a0d9df"
  },
  {
    "id": "kaiser",
    "name": "카이저",
    "description": "붉은 갑주 · 와인빛",
    "hue": 349,
    "accent": "#d79aa0"
  },
  {
    "id": "clara",
    "name": "클라라",
    "description": "보랏빛 머리 · 라벤더",
    "hue": 285,
    "accent": "#c3a0dc"
  },
  {
    "id": "ivy",
    "name": "아이비",
    "description": "초록 불꽃 · 깊은 숲빛",
    "hue": 153,
    "accent": "#8fc8ad"
  },
  {
    "id": "coin-man",
    "name": "코인맨",
    "description": "황금빛 미소 · 따뜻한 금빛",
    "hue": 40,
    "accent": "#d6bc83"
  },
  {
    "id": "oni",
    "name": "검귀",
    "description": "검붉은 갑주 · 청록 문양",
    "hue": 356,
    "accent": "#81c6bd"
  },
  {
    "id": "omen",
    "name": "오멘",
    "description": "먹빛 코트 · 붉은 눈빛",
    "hue": 222,
    "accent": "#cba09a"
  },
  {
    "id": "cannon",
    "name": "캐논",
    "description": "적동 포신 · 금빛 탄환",
    "hue": 12,
    "accent": "#d0b46f"
  },
  {
    "id": "goblin-biker",
    "name": "고블린 폭주족",
    "description": "분홍 갈기 · 황금 장비",
    "hue": 331,
    "accent": "#d59db9"
  },
  {
    "id": "master-cat",
    "name": "마스터 캣",
    "description": "남색 두건 · 청록 룬",
    "hue": 231,
    "accent": "#91c7cf"
  },
  {
    "id": "space-solider",
    "name": "우주병사",
    "description": "붉은 우주복 · 초록 바이저",
    "hue": 8,
    "accent": "#a7c18b"
  },
  {
    "id": "asura",
    "name": "아수라",
    "description": "불꽃빛 갑주 · 주황빛",
    "hue": 28,
    "accent": "#d3a36f"
  },
  {
    "id": "witch-doctor",
    "name": "부두술사",
    "description": "흰 갈기 · 연두빛 주술",
    "hue": 85,
    "accent": "#b7c788"
  },
  {
    "id": "ancient-blue-dragon",
    "name": "고대 청룡",
    "description": "비취빛 비늘 · 금빛 뿔",
    "hue": 168,
    "accent": "#9bc8bc"
  },
  {
    "id": "big-hand",
    "name": "빅 핸드",
    "description": "은빛 머리 · 청록 문양",
    "hue": 194,
    "accent": "#b1cbcb"
  },
  {
    "id": "phantom-slime",
    "name": "팬텀 슬라임",
    "description": "푸른 몸체 · 분홍 눈빛",
    "hue": 213,
    "accent": "#c59bc3"
  },
  {
    "id": "surprise-mouse",
    "name": "깜짝쥐",
    "description": "민트빛 털 · 복숭아빛 귀",
    "hue": 158,
    "accent": "#d2a6a3"
  },
  {
    "id": "latest-helicopter-machine",
    "name": "헬리콥터",
    "description": "올리브 장갑 · 청록 렌즈",
    "hue": 100,
    "accent": "#adc1a2"
  },
  {
    "id": "mimic",
    "name": "미믹",
    "description": "황금 테두리 · 청록 눈빛",
    "hue": 45,
    "accent": "#9fc4b4"
  },
  {
    "id": "scalluck",
    "name": "파오리",
    "description": "아이보리 깃털 · 짙은 잎빛",
    "hue": 119,
    "accent": "#d4c8a9"
  }
];
 const previousThemes={midnight:'ice-knight',slate:'ice-knight',forest:'ivy',plum:'clara',mocha:'coin-man'};
 const root=document.documentElement;
 const defaultTheme=themes.find(theme=>theme.id==='ice-knight');
 function colorize(target,theme){
  const colors={
   bg:'hsl('+theme.hue+' 18% 9%)',
   panel:'hsl('+theme.hue+' 18% 14%)',
   raised:'hsl('+theme.hue+' 16% 19%)',
   nav:'hsl('+theme.hue+' 20% 11%)',
   line:'hsl('+theme.hue+' 17% 30%)',
   text:'hsl('+theme.hue+' 20% 91%)',
   muted:'hsl('+theme.hue+' 16% 73%)',
   accent:theme.accent
  };
  for(const [name,color]of Object.entries(colors))target.style.setProperty('--theme-'+name,color);
 }

 let controls=[],notice=null;
 function apply(id,persist=false){
  const candidate=previousThemes[id]||id;
  const theme=themes.find(theme=>theme.id===candidate)||defaultTheme;
  const selected=theme.id;
  const changed=root.dataset.siteTheme!==selected;
  root.dataset.siteTheme=selected;
  colorize(root,theme);
  for(const input of controls)input.checked=input.value===selected;
  if(persist){
   try{
    localStorage.setItem(key,selected);
    if(notice)notice.textContent='선택한 테마를 이 브라우저에 기억했어요.';
   }catch{
    if(notice)notice.textContent='테마를 적용했어요. 브라우저 저장 공간을 사용할 수 있어야 다음 방문에도 기억할 수 있어요.';
   }
  }
  if(changed)for(const frame of document.querySelectorAll('iframe')){
   frame.contentWindow?.postMessage({channel,theme:selected},location.origin);
  }
 }
 let saved='ice-knight';
 try{saved=localStorage.getItem(key)||saved;}catch{}
 apply(saved);
 window.addEventListener('storage',event=>{
  if(event.key===key||event.key===null)apply(event.newValue);
 });
 window.addEventListener('message',event=>{
  if(parent!==window&&event.source===parent&&event.origin===location.origin&&event.data?.channel===channel){
   apply(event.data.theme);
  }
 });
 document.addEventListener('load',event=>{
  if(event.target instanceof HTMLIFrameElement){
   event.target.contentWindow?.postMessage({channel,theme:root.dataset.siteTheme},location.origin);
  }
 },true);
 function mount(){
  if(parent!==window)return;
  const nav=document.getElementById('lab-main-navigation');
  if(!nav)return;
  const open=document.createElement('button');
  open.type='button';
  open.className='lab-theme-open';
  open.innerHTML='<span aria-hidden="true">◐</span>사이트 테마';
  open.setAttribute('aria-haspopup','dialog');
  open.setAttribute('aria-controls','lab-theme-dialog');
  nav.append(open);
  const dialog=document.createElement('dialog');
  dialog.id='lab-theme-dialog';
  dialog.setAttribute('aria-labelledby','lab-theme-title');
  dialog.innerHTML='<div class="lab-theme-toolbar"><header><div><h2 id="lab-theme-title">초마신 테마</h2><p>초상화를 눌러 초마신의 색을 골라보세요.</p></div><button type="button" aria-label="테마 선택 닫기">닫기</button></header><label class="lab-theme-search"><span class="sr-only">초마신 이름 검색</span><input type="search" placeholder="초마신 이름 검색" aria-label="초마신 이름 검색"></label></div><fieldset><legend class="sr-only">초마신 테마 선택</legend></fieldset><p class="lab-theme-empty" role="status" hidden>이름에 맞는 초마신이 없어요.</p><p class="lab-theme-notice" role="status">선택한 테마는 이 브라우저에 기억해요.</p>';
  const fieldset=dialog.querySelector('fieldset'),search=dialog.querySelector('input[type=search]');
  const cards=[];
  for(const theme of themes){
   const card=document.createElement('label');
   card.className='lab-theme-card';
   card.dataset.palette=theme.id;
   colorize(card,theme);
   const input=document.createElement('input');
   input.type='radio';
   input.name='site-theme';
   input.value=theme.id;
   input.checked=theme.id===root.dataset.siteTheme;
   const sample=document.createElement('span');
   sample.className='lab-theme-sample';
   sample.setAttribute('aria-hidden','true');
   const portrait=document.createElement('img');
   portrait.src='/assets/units/'+theme.id+'.webp';
   portrait.alt='';
   portrait.draggable=false;
   portrait.loading='lazy';
   sample.append(portrait);
   const title=document.createElement('strong');
   title.textContent=theme.name;
   const description=document.createElement('small');
   description.textContent=theme.description;
   card.append(input,sample,title,description);
   input.addEventListener('change',()=>{if(input.checked)apply(theme.id,true);});
   controls.push(input);
   cards.push({card,name:theme.name.replace(/\s/g,'')});
   fieldset.append(card);
  }
  function filterThemes(){
   const query=search.value.replace(/\s/g,'');
   for(const {card,name}of cards)card.hidden=!name.includes(query);
   dialog.querySelector('.lab-theme-empty').hidden=cards.some(({card})=>!card.hidden);
  }
  search.addEventListener('input',filterThemes);
  notice=dialog.querySelector('.lab-theme-notice');
  (document.getElementById('workspace-shell')||document.body).append(dialog);
  open.onclick=()=>{
   search.value='';
   filterThemes();
   const menu=document.querySelector('.lab-mobile-menu');
   if(menu?.getAttribute('aria-expanded')==='true')menu.click();
   dialog.showModal();
   controls.find(input=>input.checked)?.closest('label').scrollIntoView({block:'nearest'});
  };
  dialog.querySelector('header button').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{
   const target=matchMedia('(max-width:760px)').matches?document.querySelector('.lab-mobile-menu'):open;
   target?.focus();
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();
