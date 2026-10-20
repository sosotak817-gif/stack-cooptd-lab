import { catalog } from './ranking-catalog.mjs';

const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply = (value, status=200) => new Response(JSON.stringify(value), {status, headers});
const fail = (message, status=400) => Object.assign(new Error(message), {status});
const hash = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), x=>x.toString(16).padStart(2,'0')).join('');

export function category(deck, target) {
  if (!['clara','goblin'].includes(deck) || !catalog.targets.some(t=>t.id===target)) throw fail('덱과 보스를 선택해 주세요.');
  return [catalog.revision, deck, target];
}
async function identity(request, required=false) {
  const token = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token && required) throw fail('브라우저 저장 공간을 허용한 후 다시 등록해 주세요.',401);
  return token ? hash(token) : null;
}
async function body(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw fail('JSON 요청이 필요합니다.',415);
  const reader=request.body?.getReader();
  if (!reader) throw fail('등록 내용이 없습니다.');
  const chunks=[]; let size=0;
  while (true) {
    const {done,value}=await reader.read(); if(done) break;
    size+=value.length;
    if(size>2048){await reader.cancel();throw fail('등록 내용이 너무 큽니다.',413);}
    chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw fail('등록 형식을 확인해 주세요.');}
}
export async function handleRankings({request,env}) {
  try {
    if (!env.DB) throw fail('랭킹 DB 연결을 준비 중입니다. 배치 계산은 계속 이용할 수 있습니다.',503);
    const url=new URL(request.url), db=env.DB;
    if(request.method==='GET') {
      const keys=category(url.searchParams.get('deck'),url.searchParams.get('target'));
      const raw=url.searchParams.get('page')??'1';
      if(!/^(?:[1-9]|1[0-9]|20)$/.test(raw)) throw fail('페이지는 1~20 범위입니다.');
      const page=Number(raw), owner=await identity(request);
      const [count,rows]=await db.batch([
        db.prepare('SELECT COUNT(*) AS total FROM rankings WHERE revision=? AND deck=? AND target=?').bind(...keys),
        db.prepare('SELECT owner,nickname,score,achieved_at FROM rankings WHERE revision=? AND deck=? AND target=? ORDER BY score DESC,achieved_at ASC,owner ASC LIMIT 50 OFFSET ?').bind(...keys,(page-1)*50)
      ]);
      return reply({revision:catalog.revision,page,total:Math.min(1000,count.results[0].total),entries:rows.results.map((row,i)=>({rank:(page-1)*50+i+1,nickname:row.nickname,score:row.score,achievedAt:row.achieved_at,mine:row.owner===owner}))});
    }
    if(request.method!=='POST') return new Response(null,{status:405,headers:{...headers,Allow:'GET, POST'}});
    if(request.headers.get('Origin')!==url.origin) throw fail('사이트에서 직접 등록해 주세요.',403);
    const owner=await identity(request,true), data=await body(request);
    if(!data||typeof data!=='object'||Array.isArray(data)) throw fail('등록 형식을 확인해 주세요.');
    const keys=category(data.deck,data.target);
    if(data.revision!==catalog.revision) throw fail('계산 버전이 변경되었습니다. 새로고침 후 등록해 주세요.',409);
    const nickname=typeof data.nickname==='string'?data.nickname.normalize('NFC').trim():'';
    if(!/^[\p{L}\p{N} _.-]{1,20}$/u.test(nickname)) throw fail('닉네임은 문자·숫자·공백·밑줄·점·하이픈으로 1~20자입니다.');
    if(typeof data.score!=='number'||!Number.isFinite(data.score)||data.score<=0||data.score>1e100) throw fail('유효한 전투력을 먼저 계산해 주세요.');
    const now=Date.now(), day=new Date(now).toISOString().slice(0,10);
    // The IP itself is never stored. Both identity and IP share a daily write budget.
    const ip=request.headers.get('CF-Connecting-IP');
    const limiter=ip?await hash(ip+day):owner;
    const limited=await db.prepare(`INSERT INTO ranking_limits(key,day,count,next_at) VALUES (?,?,1,?)
      ON CONFLICT(key) DO UPDATE SET day=excluded.day,count=CASE WHEN ranking_limits.day=excluded.day THEN ranking_limits.count+1 ELSE 1 END,next_at=excluded.next_at
      WHERE ranking_limits.next_at<=? AND (ranking_limits.day<>excluded.day OR ranking_limits.count<100) RETURNING count`).bind(limiter,day,now+10000,now).first();
    if(!limited) throw fail('등록은 10초 간격, 하루 100회까지 가능합니다. 잠시 후 다시 시도해 주세요.',429);
    const statements=[
      db.prepare(`INSERT INTO rankings(revision,deck,target,owner,nickname,score,achieved_at) VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(revision,deck,target,owner) DO UPDATE SET nickname=excluded.nickname,score=excluded.score,achieved_at=excluded.achieved_at WHERE excluded.score>rankings.score`).bind(...keys,owner,nickname,data.score,now),
      db.prepare(`DELETE FROM rankings WHERE revision=? AND deck=? AND target=? AND owner NOT IN
        (SELECT owner FROM rankings WHERE revision=? AND deck=? AND target=? ORDER BY score DESC,achieved_at ASC,owner ASC LIMIT 1000)`).bind(...keys,...keys),
      db.prepare('DELETE FROM ranking_limits WHERE day<?').bind(day),
      db.prepare('SELECT score FROM rankings WHERE revision=? AND deck=? AND target=? AND owner=?').bind(...keys,owner)
    ];
    // D1 batch is transactional: concurrent submissions cannot leave >1,000 rows in a category.
    const result=await db.batch(statements), record=result[3].results[0];
    return reply({retained:!!record,improved:result[0].meta.changes>0,score:record?.score??null},201);
  } catch(error) {
    if(!error.status) console.error('Ranking API failed:',error.message);
    return reply({error:error.status?error.message:'랭킹 저장소에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'},error.status||503);
  }
}
