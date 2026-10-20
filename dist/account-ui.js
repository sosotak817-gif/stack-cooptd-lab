(()=>{'use strict';
 const $=s=>document.querySelector(s),KEY='stack-lab-access-v1';let user=null,csrf=null,available=false,remote=null,syncBusy=false;
 const stored=()=>{try{return localStorage.getItem(KEY)}catch{return null}};
 const remember=value=>{try{localStorage.setItem(KEY,value)}catch{}};
 const chip=document.createElement('button');chip.className='account-chip';chip.textContent='접속 확인 중…';chip.disabled=true;$('.top-actions')?.prepend(chip);
 const create=(id,content)=>{const dialog=document.createElement('dialog');dialog.id=id;dialog.className='account-dialog';dialog.innerHTML=content;document.body.append(dialog);return dialog};
 const welcome=create('access-dialog',`<div class="access-logo"><img src="/logo.svg" alt=""><span>스택 연구소</span></div><h2>어떻게 시작할까요?</h2><p>나에게 맞는 저장 방식을 선택하세요.</p><button id="access-naver" class="naver-login"><b aria-hidden="true">N</b>네이버 로그인</button><small>계정에 세팅을 저장하고 다른 기기에서 불러옵니다.</small><button id="access-guest" class="guest-start">비로그인으로 시작</button><small>이 브라우저에 저장합니다. 언제든 로그인할 수 있습니다.</small><p id="access-status" role="status"></p>`);
 const account=create('account-dialog',`<div class="account-heading"><h2>내 계정</h2><button id="account-close" aria-label="계정 창 닫기">닫기</button></div><p id="account-name"></p><p>초마신·보석·특성·배치 전체를 계정에 저장합니다.</p><button id="account-sync">계정 저장 · 불러오기</button><button id="account-logout" class="guest-start">로그아웃 · 비로그인으로 이용</button><p id="account-status" role="status"></p>`);
 const sync=create('account-sync-dialog',`<div class="account-heading"><h2>세팅을 선택하세요</h2><button id="sync-close" aria-label="세팅 비교 창 닫기">나중에</button></div><p>계정과 이 기기의 세팅을 확인한 뒤 사용할 쪽을 선택하세요.</p><div class="sync-summary"><div><b>이 기기</b><span id="sync-local"></span></div><div><b>내 계정</b><span id="sync-remote"></span></div></div><button id="sync-upload">이 기기 세팅을 계정에 저장</button><button id="sync-download" class="guest-start">계정 세팅을 이 기기로 불러오기</button><button id="sync-retry" class="guest-start" hidden>최신 계정 세팅 다시 비교</button><p id="sync-status" role="status"></p>`);
 async function api(path,options={}){const response=await fetch(path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000),...options,headers:{'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{}),...options.headers}});let data;try{data=await response.json()}catch{throw Error('로그인 연결을 준비 중입니다. 비로그인으로 계속 이용할 수 있습니다.')}if(!response.ok){const error=Error(data.error||'계정 연결을 확인해 주세요.');error.status=response.status;throw error;}return data;}
 function open(dialog){if(!dialog.open)dialog.showModal();}
 function render(){chip.disabled=false;chip.textContent=user?'계정 · '+user.nickname:'비로그인 · 로그인';$('#account-name').textContent=user?user.nickname+'님으로 로그인했습니다.':'';$('#access-status').textContent=available?'':'네이버 로그인 연결을 준비 중입니다. 비로그인으로 이용할 수 있습니다.';}
 function guest(){remember('guest');welcome.close();render();}
 function login(){if(!available){$('#access-status').textContent='아직 네이버 로그인 연결이 준비되지 않았습니다. 비로그인으로 먼저 이용해 주세요.';return;}location.assign('/api/auth/naver');}
 chip.onclick=()=>{if(user)open(account);else open(welcome)};$('#access-naver').onclick=login;$('#access-guest').onclick=guest;
 welcome.addEventListener('cancel',event=>{event.preventDefault();guest()});$('#account-close').onclick=()=>account.close();$('#sync-close').onclick=()=>sync.close();
 const summary=board=>board?({normal:'일반',hard:'어려움',hell:'지옥',abyss:'심연',deepsea:'심해'}[board.mode]||'맵')+' · 배치 '+board.cells.length+'개 · 보유 보석 '+(board.inventory?.you?.length||0)+'종':'저장된 세팅 없음';
 async function prepareSync(){
  if(syncBusy)return;if(!window.StackLabAccount){$('#account-status').textContent='배치 시뮬레이터에서 계정 세팅을 저장하고 불러올 수 있습니다.';return;}
  account.close();open(sync);$('#sync-retry').hidden=true;$('#sync-status').textContent='계정 세팅을 확인하는 중…';$('#sync-upload').disabled=$('#sync-download').disabled=true;
  try{await window.StackLabAccount.ready;remote=await api('/api/account/board');$('#sync-local').textContent=summary(window.StackLabAccount.snapshot());$('#sync-remote').textContent=summary(remote.board)+(remote.updatedAt?' · '+new Date(remote.updatedAt).toLocaleString('ko-KR'):'');$('#sync-upload').disabled=false;$('#sync-download').disabled=!remote.board;$('#sync-status').textContent='계정에 저장하면 기존 계정 세팅을 바꿉니다. 불러오기는 현재 기기 세팅을 바꾸며 되돌릴 수 있습니다.';}
  catch(error){$('#sync-status').textContent=error.message;}
 }
 $('#account-sync').onclick=$('#sync-retry').onclick=prepareSync;
 $('#sync-upload').onclick=async()=>{
  if(!remote||syncBusy||!user)return;syncBusy=true;$('#sync-upload').disabled=$('#sync-download').disabled=true;
  try{const board=window.StackLabAccount.snapshot(),saved=await api('/api/account/board',{method:'PUT',body:JSON.stringify({board,revision:remote.revision})});remote={...saved,board};$('#sync-remote').textContent=summary(board)+' · 방금 저장';$('#sync-status').textContent='✓ 내 계정에 저장했습니다.';}
  catch(error){$('#sync-status').textContent=error.message;if(error.status===409){remote=null;$('#sync-retry').hidden=false;}}
  finally{syncBusy=false;$('#sync-upload').disabled=!remote;$('#sync-download').disabled=!remote?.board;}
 };
 $('#sync-download').onclick=()=>{if(!remote?.board||syncBusy)return;try{window.StackLabAccount.load(structuredClone(remote.board));$('#sync-local').textContent=summary(remote.board);$('#sync-status').textContent='✓ 계정 세팅을 불러왔습니다. 전장 되돌리기로 이전 세팅을 복원할 수 있습니다.';}catch(error){$('#sync-status').textContent='불러오기 실패: '+error.message;}};
 $('#account-logout').onclick=async()=>{const button=$('#account-logout');button.disabled=true;try{await api('/api/auth/logout',{method:'POST',body:'{}'});user=null;csrf=null;remote=null;remember('guest');account.close();render();}catch(error){$('#account-status').textContent=error.message;}finally{button.disabled=false;}};
 window.StackLabAuth={save:()=>user?prepareSync():Promise.resolve()};
 (async()=>{
  const url=new URL(location.href),loggedIn=url.searchParams.get('login')==='success',loginError=url.searchParams.get('login_error');
  if(loggedIn||loginError){url.searchParams.delete('login');url.searchParams.delete('login_error');history.replaceState(null,'',url.pathname+url.search+url.hash);}
  try{const data=await api('/api/auth/session');available=data.ready;user=data.user;csrf=data.csrf;if(user)remember('account');}
  catch(error){$('#access-status').textContent=error.message;}
  render();if(user){if(loggedIn)await prepareSync();return;}
  if(loginError||stored()!=='guest'){open(welcome);if(loginError)$('#access-status').textContent=loginError==='cancelled'?'로그인이 취소되었습니다. 다시 로그인하거나 비로그인으로 시작하세요.':'네이버 로그인을 완료하지 못했습니다. 비로그인으로 계속 이용할 수 있습니다.';}
 })();
})();
