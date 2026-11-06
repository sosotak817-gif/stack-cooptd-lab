import {publicAccess} from '../../server/feature-access.mjs';
export async function onRequest({request,env}){
 if(request.method!=='GET')return new Response(null,{status:405});
 try{
  const path=new URL(request.url).searchParams.get('path')||'/';
  if(path.length>256||!path.startsWith('/'))return Response.json({error:'기능 경로를 확인하세요.'},{status:400});
  return Response.json(await publicAccess(request,env,path),{headers:{'Cache-Control':'no-store'}});
 }catch{
  return Response.json({error:'접근 조건을 확인하지 못했습니다.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
