import { achievements } from '../../server/achievements.mjs';

export async function onRequest({request,env}) {
 const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='GET')return reply({error:'지원하지 않는 요청입니다.'},405);
 try {
  const codes=achievements.map(({code})=>code);
  const placeholders=codes.map(()=>'?').join(',');
  const {results}=await env.DB.prepare(`
   SELECT u.nickname, SUM(CASE WHEN earned.code IN (${placeholders}) THEN 1 ELSE 0 END) AS general,
    SUM(CASE WHEN earned.code LIKE 'hidden-%' THEN 1 ELSE 0 END) AS hidden,
    COUNT(*) AS total, featured.code AS badgeCode, badge.title AS badgeTitle
   FROM lab_user_achievements earned JOIN lab_users u ON u.id=earned.user_id
   LEFT JOIN lab_featured_badges featured ON featured.user_id=u.id
   LEFT JOIN lab_achievements badge ON badge.code=featured.code
   WHERE earned.code IN (${placeholders}) OR earned.code LIKE 'hidden-%'
   GROUP BY u.id,u.nickname,featured.code,badge.title
   ORDER BY total DESC,u.nickname COLLATE NOCASE,u.id LIMIT 50
  `).bind(...codes,...codes).all();
  return reply({rows:results});
 }catch{
  return reply({error:'업적 랭킹을 불러오지 못했습니다.'},503);
 }
}
