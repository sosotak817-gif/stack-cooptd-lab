(async()=>{
 const $=id=>document.getElementById(id);
 let session,busy=false;
 async function api(method='GET',body) {
  const response=await fetch('/api/admin',{method,cache:'no-store',headers:{
   'X-Account-Id':session.user.id,...(method==='POST'?{'X-CSRF-Token':session.csrf,'Content-Type':'application/json'}:{})
  },...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();
  if(!response.ok)throw Error(result.error);
  return result;
 }
 async function run(body){
  if(busy)return;
  busy=true;
  $('admin-run').disabled=true;
  $('admin-status').textContent='처리 중…';
  try {
   const result=await api('POST',body);
   $('admin-result').textContent=JSON.stringify(result,null,2);
   $('admin-status').textContent=result.message||'완료 · 변경 '+result.changes+'건';
  }catch(error){$('admin-status').textContent=error.message;}
  finally{busy=false;$('admin-run').disabled=false;}
 }
 try {
  const response=await fetch('/api/auth/me',{cache:'no-store'});
  session=await response.json();
  if(!session.user)throw Error('로그인 후 이용해 주세요.');
  const state=await api();
  for(const name of state.tables){
   const option=document.createElement('option');option.value=option.textContent=name;$('admin-table').append(option);
  }
  $('admin-content').hidden=false;
  $('admin-access').hidden=true;
  for(const button of document.querySelectorAll('[data-reset]'))button.onclick=()=>{
   if(confirm(button.textContent+'를 실행할까요? 기존 투표가 삭제됩니다.'))run({action:'reset-votes',kind:button.dataset.reset});
  };
  $('admin-inspect').onclick=()=>{
   const table=$('admin-table').value;
   if(!state.tables.includes(table))return;
   $('admin-sql').value='SELECT * FROM "'+table.replaceAll('"','""')+'" LIMIT 100';
   run({action:'sql',sql:$('admin-sql').value});
  };
  $('admin-sql-form').onsubmit=event=>{
   event.preventDefault();
   const sql=$('admin-sql').value.trim();
   if(!/^SELECT\b/i.test(sql)&&!$('admin-write').checked){$('admin-status').textContent='데이터 변경 SQL 실행 허용을 선택하세요.';return;}
   if(!/^SELECT\b/i.test(sql)&&!confirm('SQL을 실행해 데이터를 변경할까요?'))return;
   run({action:'sql',sql});
  };
 }catch(error){$('admin-access').textContent=error.message;}
})();
