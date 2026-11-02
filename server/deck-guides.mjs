import Journey from '../ui/journey-core.js';
import {catalog} from './guide-catalog.mjs';

const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const schemas=new WeakMap(),modes=Journey.MODES,tiles=new Set(catalog.tiles),units=new Set(Object.keys(catalog.units)),gems=new Set(catalog.gems);
const D={DEMON_BY_SLUG:units,GEM_BY_ID:gems,GRADES:catalog.grades,EMPTY_GEM_ID:'',maxLevelFor:slug=>catalog.units[slug]},G={buildable:(row,col)=>tiles.has(row+':'+col)},T={TARGET_BY_ID:new Set(catalog.targets),lastWave:mode=>catalog.lastWave[mode]};
const schema=`CREATE TABLE IF NOT EXISTS deck_guides (id TEXT PRIMARY KEY, owner TEXT NOT NULL, nickname TEXT NOT NULL, title TEXT NOT NULL, mode TEXT NOT NULL, wave INTEGER NOT NULL, summary TEXT NOT NULL, units TEXT NOT NULL, guide TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`;
async function initialize(db){if(!schemas.has(db))schemas.set(db,db.batch([db.prepare(schema),db.prepare('CREATE INDEX IF NOT EXISTS deck_guides_recent ON deck_guides(created_at DESC,id DESC)'),db.prepare('CREATE INDEX IF NOT EXISTS deck_guides_mode_recent ON deck_guides(mode,created_at DESC,id DESC)'),db.prepare('CREATE INDEX IF NOT EXISTS deck_guides_owner_recent ON deck_guides(owner,created_at DESC)')]).catch(error=>{schemas.delete(db);throw error;}));await schemas.get(db);}
async function identity(request,required=false){const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token){if(required)throw fail('이 브라우저의 작성자 정보를 저장할 수 없습니다. 저장 공간을 허용해 주세요.',401);return null;}return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),n=>n.toString(16).padStart(2,'0')).join('');}
async function body(request){if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw fail('JSON 요청이 필요합니다.',415);const reader=request.body?.getReader();if(!reader)throw fail('게시글 내용이 없습니다.');let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();throw fail('덱을 포함한 게시글은 256KB 이하로 작성해 주세요.',413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}try{return Journey.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw fail('게시글 형식을 확인해 주세요.');}}
function nickname(value){const text=typeof value==='string'?value.normalize('NFC').trim():'';if(!text||Array.from(text).length>20||/[\p{Cc}\p{Cf}\p{Cs}]/u.test(text))throw fail('작성자 닉네임을 1~20자로 입력해 주세요.');return text;}
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));
function validateTree(value,depth=0){if(depth>16)throw fail('게시글 데이터가 너무 깊게 중첩되어 있습니다.');if(typeof value==='number'&&(!Number.isFinite(value)||Math.abs(value)>1e18))throw fail('덱 수치의 범위를 확인해 주세요.');if(typeof value==='string'&&value.length>8000)throw fail('게시글 내용을 줄여 주세요.');if(value&&typeof value==='object'){const entries=Object.values(value);if(entries.length>512)throw fail('덱 항목이 너무 많습니다.');for(const entry of entries)validateTree(entry,depth+1);}}
// Public posts contain gameplay settings, never unrelated fields added to a local save.
function publicGuide(value){let clean;try{clean=Journey.guide(value,D,G,T);}catch(error){throw fail(error.message);}const deck=pick(clean.deck,['version','unitDefaultsVersion','mode','target','partnerEnabled','cells','marks','you','partner','fullProgress','omenGrowth','stackFromWaveOne','pressureContext']);
 deck.cells=deck.cells.map(cell=>pick(cell,['row','col','slug','lib','nolib','eggby','installWave','libWave']));
 deck.marks=(deck.marks||[]).map(mark=>pick(mark,['row','col','boost','grace','storms','stormBy','contract']));
 for(const side of ['you','partner']){deck[side]=pick(deck[side],catalog.accountKeys);deck[side].perDemon=Object.fromEntries(Object.entries(clean.deck[side].perDemon).map(([slug,own])=>[slug,pick(own,['level','lib','skinLevels','relicLevel','installWave','lastWave','libWave','gems'])]));}
 return{...clean,deck};
}
function postId(value){if(typeof value!=='string'||!/^([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i.test(value))throw fail('게시글 주소를 확인해 주세요.');return value;}
const summaryRow=(row,owner)=>({id:row.id,nickname:row.nickname,title:row.title,mode:row.mode,wave:row.wave,summary:row.summary,units:JSON.parse(row.units),createdAt:row.created_at,updatedAt:row.updated_at,mine:row.owner===owner});
async function detail(db,id,owner){const row=await db.prepare('SELECT * FROM deck_guides WHERE id=?').bind(id).first();if(!row)throw fail('게시글을 찾을 수 없습니다.',404);return{...summaryRow(row,owner),guide:JSON.parse(row.guide)};}
export async function handleDeckGuides({request,env}){
 try{
  const method=request.method,url=new URL(request.url);if(!['GET','POST','PUT','DELETE'].includes(method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, POST, PUT, DELETE'}});
  if(!env.DB)throw fail('공략 게시판 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',503);
  const db=env.DB;await initialize(db);
  const owner=await identity(request,method!=='GET');
  if(method==='GET'){
   if(url.searchParams.has('id'))return reply({post:await detail(db,postId(url.searchParams.get('id')),owner)});
   const pageText=url.searchParams.get('page')||'1',mode=url.searchParams.get('mode')||'',q=(url.searchParams.get('q')||'').trim(),mine=url.searchParams.get('mine')==='1';
   if(!/^[1-9]\d{0,3}$/.test(pageText)||mode&&!Object.hasOwn(modes,mode)||q.length>80)throw fail('검색 조건을 확인해 주세요.');if(mine&&!owner)throw fail('이 브라우저의 작성자 정보가 없습니다.',401);
   const conditions=[],values=[];if(mode){conditions.push('mode=?');values.push(mode);}if(mine){conditions.push('owner=?');values.push(owner);}if(q){conditions.push('(instr(lower(title),lower(?))>0 OR instr(lower(nickname),lower(?))>0 OR instr(lower(summary),lower(?))>0)');values.push(q,q,q);}
   const where=conditions.length?' WHERE '+conditions.join(' AND '):'',page=Number(pageText),limit=12;
   const [count,rows]=await db.batch([db.prepare('SELECT COUNT(*) AS total FROM deck_guides'+where).bind(...values),db.prepare('SELECT id,owner,nickname,title,mode,wave,summary,units,created_at,updated_at FROM deck_guides'+where+' ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?').bind(...values,limit,(page-1)*limit)]);
   return reply({page,pageSize:limit,total:count.results[0].total,posts:rows.results.map(row=>summaryRow(row,owner))});
  }
  if(request.headers.get('Origin')!==url.origin)throw fail('사이트에서 직접 게시해 주세요.',403);
  const input=await body(request);if(!input||typeof input!=='object'||Array.isArray(input))throw fail('게시글 형식을 확인해 주세요.');validateTree(input);
  let current=null;if(method!=='POST'){const id=postId(input.id);current=await db.prepare('SELECT id,owner,updated_at FROM deck_guides WHERE id=?').bind(id).first();if(!current)throw fail('게시글을 찾을 수 없습니다.',404);if(current.owner!==owner)throw fail('이 브라우저에서 작성한 글만 수정·삭제할 수 있습니다.',403);if(!Number.isSafeInteger(input.expectedUpdatedAt)||input.expectedUpdatedAt!==current.updated_at)throw fail('게시글이 변경되었습니다. 다시 열어 확인해 주세요.',409);}
  if(method==='DELETE'){const result=await db.prepare('DELETE FROM deck_guides WHERE id=? AND owner=? AND updated_at=?').bind(current.id,owner,current.updated_at).run();if(!result.meta.changes)throw fail('게시글이 변경되었습니다. 다시 확인해 주세요.',409);return reply({deleted:true,id:current.id});}
  const author=nickname(input.nickname),guide=publicGuide(input.guide),encoded=JSON.stringify(guide);if(new TextEncoder().encode(encoded).length>240000)throw fail('덱 설정이 너무 큽니다. 공략 파일로 공유해 주세요.',413);
  const slugs=[...new Set(guide.deck.cells.filter(c=>guide.deck.partnerEnabled||c.row>5).map(c=>c.slug))],summary=guide.operation.slice(0,160),now=Math.max(Date.now(),(current?.updated_at||0)+1);
  if(method==='POST'){
   const id=crypto.randomUUID(),result=await db.prepare('INSERT INTO deck_guides(id,owner,nickname,title,mode,wave,summary,units,guide,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM deck_guides WHERE owner=?)<50 AND NOT EXISTS (SELECT 1 FROM deck_guides WHERE owner=? AND created_at>?)').bind(id,owner,author,guide.title,guide.mode,guide.wave,summary,JSON.stringify(slugs),encoded,now,now,owner,owner,now-30000).run();
   if(!result.meta.changes)throw fail('게시글은 30초에 한 번, 브라우저당 50개까지 작성할 수 있습니다.',429);
   return reply({post:await detail(db,id,owner)},201);
  }
  const result=await db.prepare('UPDATE deck_guides SET nickname=?,title=?,mode=?,wave=?,summary=?,units=?,guide=?,updated_at=? WHERE id=? AND owner=? AND updated_at=?').bind(author,guide.title,guide.mode,guide.wave,summary,JSON.stringify(slugs),encoded,now,current.id,owner,current.updated_at).run();if(!result.meta.changes)throw fail('게시글이 변경되었습니다. 다시 열어 주세요.',409);return reply({post:await detail(db,current.id,owner)});
 }catch(error){return reply({error:error.status?error.message:'게시판 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'},error.status||503);}
}
