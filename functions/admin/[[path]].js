import {requireAdmin} from '../../server/admin.mjs';

export async function onRequest({request,env,next}) {
 try {
  await requireAdmin(request,env);
  const response=await next();
  const headers=new Headers(response.headers);
  headers.set('Cache-Control','private, no-store');
  return new Response(response.body,{status:response.status,headers});
 }catch(error){
  return new Response(error.status===401?'로그인 후 이용해 주세요.':'관리자만 접근할 수 있습니다.',{
   status:error.status||503,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}
  });
 }
}
