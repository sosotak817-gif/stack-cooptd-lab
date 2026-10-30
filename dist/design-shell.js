(()=>{'use strict';const embedded=parent!==window;document.documentElement.classList.add('lab-dark');if(embedded){document.documentElement.classList.add('lab-embedded');const actions=document.querySelector('body>.top .top-actions');if(actions){const bar=document.createElement('div');bar.className='tool-actions-bar';bar.append(actions);document.body.prepend(bar);}return;}const links=[['/','대시보드','▦'],['/lab/','배치 · DPS','⌖'],['/units/','초마신 도감','♧'],['/dealer-tiers/','티어리스트 투표','▥'],['/stages/','스테이지 분석','◎'],['/wall/','성벽 조합','♜'],['/rankings/','솔로 랭킹','▥'],['/updates/','업데이트','↗']];const aside=document.createElement('aside');aside.className='lab-sidebar';const brand=document.createElement('a');brand.className='lab-brand';brand.href='/';brand.innerHTML='<img src="/logo.svg" alt="스택 연구소 기존 로고"><span>스택 연구소<small>STACK LAB</small></span>';aside.append(brand);const nav=document.createElement('nav');nav.setAttribute('aria-label','주요 연구 도구');for(const [href,label,icon]of links){const a=document.createElement('a');a.href=href;if(location.pathname===href){a.className='active';a.setAttribute('aria-current','page');}const glyph=document.createElement('span');glyph.textContent=icon;glyph.setAttribute('aria-hidden','true');a.append(glyph,document.createTextNode(label));nav.append(a);}aside.append(nav);const caption=document.createElement('p');caption.className='sidebar-caption';caption.innerHTML='더 깊이,<br>더 강한 덱을 위해.<small>스택 연구소와 함께.</small>';aside.append(caption);document.body.prepend(aside);const top=document.createElement('div');top.className='lab-topbar';top.innerHTML='<span class="lab-breadcrumb">WORKSPACE <i>/</i> <b>OVERVIEW</b></span><div class="lab-top-actions"><a href="/units/" class="lab-search">⌕ <span>초마신 · 보석을 연구해 보세요</span></a><a href="/updates/" aria-label="업데이트 확인">♧</a><span class="lab-local-label">STACK LAB</span></div>';document.body.insertBefore(top,aside.nextSibling);const actions=document.querySelector('body>.top .top-actions');if(actions)top.querySelector('.lab-top-actions').append(actions);const sync=()=>{for(const a of nav.querySelectorAll('a')){const active=new URL(a.href).pathname===location.pathname;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}top.querySelector('.lab-breadcrumb b').textContent=location.pathname==='/'?'OVERVIEW':links.find(([href])=>href===location.pathname)?.[1]||'WORKSPACE';};new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});window.addEventListener('popstate',sync);window.addEventListener('stack-lab:navigate',sync);sync();})();

// Each document or nested scrolling region owns its own back-to-top control.
(()=>{'use strict';
const controls=new Map;let queued=false;
const page=()=>document.scrollingElement;
function register(target){
 if(!target||controls.has(target))return;
 const button=document.createElement('button');button.type='button';button.className='scroll-top-control';button.hidden=true;button.textContent='↑';button.setAttribute('aria-label','이 영역 맨 위로 이동');button.title='맨 위로';
 const dialog=target.closest('dialog');(dialog||document.body).append(button);
 button.addEventListener('click',()=>target.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
 controls.set(target,button);
}
function render(){
 queued=false;
 for(const [target,button]of controls){
  if(!target.isConnected){button.remove();controls.delete(target);continue;}
  const isPage=target===page(),rect=isPage?{left:0,top:0,right:innerWidth,bottom:innerHeight}:target.getBoundingClientRect();
  let bottom=Math.min(rect.bottom,innerHeight),right=Math.min(rect.right,innerWidth),top=Math.max(rect.top,0),left=Math.max(rect.left,0);
  for(let ancestor=target.parentElement;!isPage&&ancestor&&ancestor!==document.body;ancestor=ancestor.parentElement){const style=getComputedStyle(ancestor);if(/auto|scroll|hidden|clip/.test(style.overflowY)){const clip=ancestor.getBoundingClientRect();top=Math.max(top,clip.top);bottom=Math.min(bottom,clip.bottom);}if(/auto|scroll|hidden|clip/.test(style.overflowX)){const clip=ancestor.getBoundingClientRect();left=Math.max(left,clip.left);right=Math.min(right,clip.right);}}
  const visible=target.scrollTop>0&&target.scrollHeight>target.clientHeight&&target.getClientRects().length>0&&bottom-top>56&&right-left>56&&!(isPage&&document.body.classList.contains('workspace-away'));
  if(button.hidden===visible)button.hidden=!visible;if(!visible)continue;
  const dock=isPage&&document.body.classList.contains('has-workspace')?68:12;
  button.style.right=Math.max(12,innerWidth-right+12)+'px';button.style.bottom=Math.max(dock,innerHeight-bottom+12)+'px';
 }
}
function schedule(){if(!queued){queued=true;requestAnimationFrame(render);}}
document.addEventListener('scroll',event=>{const target=event.target===document?page():event.target;if(target instanceof Element&&target.scrollTop>0)register(target);schedule();},{capture:true,passive:true});
window.addEventListener('resize',schedule,{passive:true});window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('stack-lab:workspace-visible',schedule);window.addEventListener('stack-lab:navigate',schedule);
function init(){register(page());for(const element of document.querySelectorAll('*'))if(element.scrollTop>0)register(element);schedule();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','open','hidden']});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.addEventListener('pageshow',schedule);
})();

