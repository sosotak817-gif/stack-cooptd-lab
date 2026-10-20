(()=>{'use strict';
 const $=s=>document.querySelector(s),KEY='stack-lab-vault-v1';let linked=null,remote=null,busy=false,loading=false,conflict=false,ready=false,dirty=false,linkIssue=false,timer;
 const chip=document.createElement('button');chip.className='account-chip';chip.textContent='기기 저장 · 연결';$('.top-actions')?.prepend(chip);
 const dialog=document.createElement('dialog');dialog.className='account-dialog';dialog.id='vault-dialog';dialog.innerHTML=`<div class="account-heading"><h2>저장 · 브라우저 연결</h2><button id="vault-close" aria-label="저장소 창 닫기">닫기</button></div><p>기본 세팅은 이 브라우저에 자동 저장됩니다. 다른 브라우저·기기와 이어 쓰려면 같은 개인 저장소 코드를 연결하세요.</p><section id="vault-unlinked"><button id="vault-create">이 기기 세팅으로 개인 저장소 만들기</button><label class="vault-code-label" for="vault-code">기존 개인 저장소 코드</label><input id="vault-code" class="vault-code" placeholder="SL-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" autocomplete="off" autocapitalize="characters" spellcheck="false"><button id="vault-connect" class="guest-start">코드로 연결</button></section><section id="vault-linked" hidden><label class="vault-code-label" for="vault-secret">내 개인 저장소 코드</label><input id="vault-secret" class="vault-code" readonly aria-label="내 개인 저장소 코드"><button id="vault-copy">코드 복사</button><small>다른 브라우저에서도 이 코드를 한 번 입력하세요. 코드를 가진 사람은 세팅을 읽고 수정할 수 있으니 따로 보관해 주세요.</small><button id="vault-refresh">최신 세팅 확인 · 동기화</button><button id="vault-disconnect" class="guest-start">이 브라우저 연결 해제</button></section><section id="vault-conflict" hidden><h3>어느 세팅을 사용할까요?</h3><p>저장소와 이 브라우저의 세팅이 다릅니다. 사용할 쪽을 선택하면 양쪽에 반영됩니다.</p><div class="sync-summary"><div><b>이 브라우저</b><span id="vault-local-summary"></span></div><div><b>개인 저장소</b><span id="vault-remote-summary"></span></div></div><button id="vault-use-local">이 브라우저 세팅 사용</button><button id="vault-use-remote" class="guest-start">저장소 세팅 불러오기</button></section><p id="vault-status" role="status"></p><small>저장소는 최근 세팅 1개를 보관하며 180일간 연결하지 않으면 만료됩니다. 연결하지 않은 브라우저의 세팅은 서버에 전송하지 않습니다.</small>`;document.body.append(dialog);
 const api=async(method='GET',board,revision,secret=linked?.code)=>{const response=await fetch('/api/vault',{method,cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',...(secret?{Authorization:'Bearer '+secret}:{})},...(board?{body:JSON.stringify({board,revision})}:{})});let data;try{data=await response.json()}catch{throw Error('개인 저장소 연결을 준비 중입니다. 기기 저장은 계속 이용할 수 있습니다.')}if(!response.ok){const error=Error(data.error||'저장소 연결을 확인해 주세요.');error.status=response.status;throw error;}return data;};
 const fingerprint=async board=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(board)))),x=>x.toString(16).padStart(2,'0')).join('');
 const adapter=async()=>{if(!window.StackLabAccount)throw Error('배치 시뮬레이터에서 저장소를 연결해 주세요.');await window.StackLabAccount.ready;return window.StackLabAccount;};
 const summary=board=>({normal:'일반',hard:'어려움',hell:'지옥',abyss:'심연',deepsea:'심해'}[board.mode]||'맵')+' · 배치 '+board.cells.length+'개 · 보석 '+(board.inventory?.you?.length||0)+'종';
 const status=text=>{$('#vault-status').textContent=text;chip.title=text;};
 function persist(){if(linked)localStorage.setItem(KEY,JSON.stringify(linked));else localStorage.removeItem(KEY);}
 function render(){chip.textContent=linked?(linkIssue?'저장소 · 연결 확인':'개인 저장소 · 연결됨'):'기기 저장 · 연결';$('#vault-unlinked').hidden=!!linked;$('#vault-linked').hidden=!linked;$('#vault-secret').value=linked?.code||'';$('#vault-conflict').hidden=!conflict;for(const id of ['vault-create','vault-connect','vault-refresh','vault-disconnect','vault-use-local','vault-use-remote'])$('#'+id).disabled=busy||loading;}
 function showConflict(value,board){remote=value;conflict=true;$('#vault-local-summary').textContent=summary(board);$('#vault-remote-summary').textContent=summary(value.board);render();if(!dialog.open)dialog.showModal();status('양쪽 변경을 보관 중입니다. 사용할 세팅을 선택해 주세요.');}
 async function synchronized(value,board){const next={code:linked.code,revision:value.revision,syncedHash:await fingerprint(board)};linked=next;remote=value;conflict=false;linkIssue=false;persist();render();status('✓ 개인 저장소와 동기화했습니다. 다른 브라우저로 돌아오면 최신 세팅을 확인합니다.');}
 async function refresh(){
  if(!linked||busy||loading)return;busy=true;render();const secret=linked.code;
  try{const a=await adapter(),value=await api('GET'),board=a.snapshot(),localHash=await fingerprint(board),remoteHash=await fingerprint(value.board);if(linked?.code!==secret)return;
   if(localHash===remoteHash){await synchronized(value,board);return;}
   if(linked.syncedHash&&localHash===linked.syncedHash){if(JSON.stringify(a.snapshot())!==JSON.stringify(board)){dirty=true;return;}a.load(structuredClone(value.board));await synchronized(value,a.snapshot());return;}
   if(linked.syncedHash&&remoteHash===linked.syncedHash){const saved=await api('PUT',board,value.revision);await synchronized({...saved,board},board);return;}
   showConflict(value,board);
  }catch(error){linkIssue=true;status(error.message+' · 이 브라우저의 세팅은 유지됩니다.');}
  finally{finish();}
 }
 async function upload(){
  if(!linked||conflict)return;if(busy||loading){dirty=true;return;}dirty=false;busy=true;render();
  try{const a=await adapter(),board=a.snapshot();if(await fingerprint(board)===linked.syncedHash)return;const value=await api('PUT',board,linked.revision);await synchronized({...value,board},board);}
  catch(error){if(error.status===409){busy=false;await refresh();return;}linkIssue=true;status('기기 저장 완료 · 저장소 동기화 대기: '+error.message);}
  finally{finish();}
 }
 function schedule(){if(!linked)return;dirty=true;clearTimeout(timer);if(!busy&&!loading&&!conflict)timer=setTimeout(upload,1200);}
 function finish(){busy=false;render();if(dirty&&linked&&!conflict)schedule();}
 async function open(){if(!dialog.open)dialog.showModal();render();if(linked){await refresh();return;}try{const response=await fetch('/api/vault/status',{cache:'no-store',signal:AbortSignal.timeout(8000)}),data=await response.json();ready=!!data.ready;status(ready?'이 기기에서만 사용하거나, 필요할 때 저장소를 만들고 연결하세요.':'개인 저장소 DB 연결을 준비 중입니다. 기기 저장은 바로 사용할 수 있습니다.');}catch{ready=false;status('개인 저장소 연결을 확인할 수 없습니다. 기기 저장은 계속 이용할 수 있습니다.');}}
 chip.onclick=open;$('#vault-close').onclick=()=>dialog.close();
 $('#vault-create').onclick=async()=>{
  if(busy||loading)return;if(!ready){status('저장소 DB 연결이 준비되지 않았습니다. 기기 저장을 계속 이용해 주세요.');return;}busy=true;render();
  try{const a=await adapter(),board=a.snapshot(),value=await api('POST',board);linked={code:value.code,revision:value.revision,syncedHash:await fingerprint(board)};persist();if(JSON.stringify(a.snapshot())!==JSON.stringify(board))dirty=true;render();status('✓ 저장소를 만들었습니다. 코드를 복사해 다른 브라우저에 연결하세요.');}
  catch(error){status(error.message);}finally{finish();}
 };
 $('#vault-connect').onclick=async()=>{
  if(busy||loading)return;if(!ready){status('저장소 DB 연결이 준비되지 않았습니다. 기기 저장을 계속 이용해 주세요.');return;}const code=$('#vault-code').value.trim().toUpperCase();if(!/^SL(?:[-\s]?[A-F0-9]{8}){4}$/.test(code)){status('SL로 시작하는 저장소 코드 전체를 입력해 주세요.');return;}busy=true;render();
  try{const a=await adapter(),value=await api('GET',undefined,undefined,code),board=a.snapshot();linked={code,revision:value.revision,syncedHash:null};persist();$('#vault-code').value='';if(await fingerprint(board)===await fingerprint(value.board))await synchronized(value,board);else showConflict(value,board);}
  catch(error){status(error.message);}finally{finish();}
 };
 $('#vault-use-local').onclick=async()=>{if(!remote||!linked||busy||loading)return;busy=true;render();try{const a=await adapter(),board=a.snapshot(),value=await api('PUT',board,remote.revision);await synchronized({...value,board},board);}catch(error){status(error.message);if(error.status===409){busy=false;await refresh();}}finally{finish();}};
 $('#vault-use-remote').onclick=async()=>{if(!remote||!linked||busy||loading)return;busy=true;render();try{const a=await adapter(),before=JSON.stringify(a.snapshot()),value=await api('GET');if(JSON.stringify(a.snapshot())!==before){showConflict(value,a.snapshot());status('불러오는 동안 이 브라우저의 세팅이 변경되었습니다. 다시 선택해 주세요.');return;}a.load(structuredClone(value.board));await synchronized(value,a.snapshot());}catch(error){status(error.message);}finally{finish();}};
 $('#vault-refresh').onclick=refresh;
 $('#vault-copy').onclick=async()=>{if(!linked)return;try{await navigator.clipboard.writeText(linked.code);status('✓ 코드를 복사했습니다. 다른 브라우저의 코드로 연결에 붙여 넣으세요.');}catch{$('#vault-secret').focus();$('#vault-secret').select();status('코드를 직접 복사해 주세요.');}};
 $('#vault-disconnect').onclick=()=>{clearTimeout(timer);linked=null;remote=null;conflict=false;dirty=false;linkIssue=false;persist();render();status('이 브라우저 연결을 해제했습니다. 세팅은 이 브라우저에 남아 있으며 같은 코드로 다시 연결할 수 있습니다.');};
 window.StackLabAuth={save:()=>linked?upload():Promise.resolve()};
 window.addEventListener('stack-lab:state-saved',schedule);window.addEventListener('focus',()=>{if(linked&&!conflict)refresh()});window.addEventListener('online',()=>{if(linked&&!conflict)refresh()});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&linked&&!conflict)refresh()});
 try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&typeof saved.code==='string'&&/^SL(?:[-\s]?[A-F0-9]{8}){4}$/i.test(saved.code)&&Number.isInteger(saved.revision)&&saved.revision>0)linked=saved;}catch{}
 render();if(linked){loading=true;render();adapter().then(()=>{loading=false;return refresh()}).catch(error=>{loading=false;render();status(error.message)});}
})();
