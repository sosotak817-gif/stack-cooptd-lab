const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
const seoulDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const offsetDay=(day,offset)=>{const date=new Date(day+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);};
const schemas=new WeakMap();
async function ensureSchema(db){if(!schemas.has(db))schemas.set(db,db.batch([
 db.prepare('CREATE TABLE IF NOT EXISTS daily_visitors(day TEXT NOT NULL,visitor_hash TEXT NOT NULL,PRIMARY KEY(day,visitor_hash))'),
 db.prepare('CREATE INDEX IF NOT EXISTS daily_visitors_day ON daily_visitors(day)')
]).catch(error=>{schemas.delete(db);throw error;}));await schemas.get(db);}
export async function handleVisitors({request,env}){
 try{
  if(!env.DB)return reply({error:'방문 통계를 불러올 수 없습니다.'},503);
  const db=env.DB,day=seoulDay();await ensureSchema(db);
  if(request.method==='GET'){
   const since=offsetDay(day,-6),rows=await db.prepare('SELECT day,COUNT(*) AS visitors FROM daily_visitors WHERE day>=? AND day<=? GROUP BY day ORDER BY day').bind(since,day).all(),counts=new Map(rows.results.map(row=>[row.day,Number(row.visitors)]));
   const first=rows.results[0]?.day;
   return reply({days:first?Array.from({length:Math.round((Date.parse(day)-Date.parse(first))/86400000)+1},(_,index)=>{const date=offsetDay(first,index);return{date,visitors:counts.get(date)||0};}):[]});
  }
  if(request.method!=='POST')return new Response(null,{status:405,headers:{...headers,Allow:'GET, POST'}});
  const url=new URL(request.url);if(request.headers.get('Origin')!==url.origin)return reply({error:'요청 출처를 확인할 수 없습니다.'},403);
  const ip=request.headers.get('CF-Connecting-IP');if(!ip)return reply({tracked:false});
  // Keep only a per-day digest. The source IP is never written to storage.
  const visitorHash=await hash(day+'\n'+ip+'\n'+(env.VISITOR_HASH_SECRET||''));
  await db.batch([
   db.prepare('INSERT OR IGNORE INTO daily_visitors(day,visitor_hash) VALUES(?,?)').bind(day,visitorHash),
   db.prepare('DELETE FROM daily_visitors WHERE day<?').bind(offsetDay(day,-45))
  ]);
  return reply({tracked:true});
 }catch(error){console.error('Visitor count failed:',error.message);return reply({error:'방문 통계를 기록할 수 없습니다.'},503);}
}
