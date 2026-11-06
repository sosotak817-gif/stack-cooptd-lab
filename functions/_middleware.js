import {featureIdsForRequest,requireFeatureAccess} from '../server/feature-access.mjs';

export async function onRequest(context){
 const {request,env}=context,url=new URL(request.url);
 const ids=featureIdsForRequest(url.pathname,request.method,url.searchParams.get('kind')||'demons',url.searchParams.get('challenge')||'');
 if(!ids.length)return context.next();
 try{
  const decision=await requireFeatureAccess(request,env,ids);
  const response=await context.next(),headers=new Headers(response.headers);
  if(!decision.public)headers.set('Cache-Control','private, no-store');
  return new Response(response.body,{status:response.status,headers});
 }catch(error){
  const status=error.status||503,message=error.status?error.message:'접근 조건을 확인하지 못했습니다.';
  if(url.pathname.startsWith('/api/'))return Response.json({error:message,feature:error.feature},{status,headers:{'Cache-Control':'no-store'}});
  return new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>이용 안내 · 스택 연구소</title><body style="margin:0;background:#0b1523;color:#e5edf8;font:16px sans-serif"><main style="max-width:36rem;margin:15vh auto;padding:1.5rem"><h1>이용 안내</h1><p>'+message+'</p><p><a style="color:#8cf3d9" href="/account/">로그인·계정</a> · <a style="color:#8cf3d9" href="/">대시보드</a></p></main></body></html>',{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});
 }
}
