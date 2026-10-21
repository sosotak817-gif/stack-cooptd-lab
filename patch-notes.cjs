const TYPES={feature:'기능 추가',fix:'버그 수정',calculation:'계산 기준',performance:'성능 개선'};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function validate(entries){
 if(!Array.isArray(entries)||!entries.length)throw Error('패치 로그를 한 개 이상 작성하세요.');
 const ids=new Set;
 for(const entry of entries){
  if(!/^[a-z0-9-]+$/.test(entry.id)||ids.has(entry.id))throw Error('패치 로그 id가 잘못되었거나 중복됩니다.');
  ids.add(entry.id);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)||!Number.isFinite(Date.parse(entry.date))||new Date(entry.date).toISOString().slice(0,10)!==entry.date)throw Error('패치 로그 날짜를 YYYY-MM-DD로 작성하세요.');
  if(!TYPES[entry.type]||typeof entry.title!=='string'||!entry.title.trim()||!Array.isArray(entry.details)||!entry.details.length||entry.details.some(v=>typeof v!=='string'||!v.trim()))throw Error('패치 로그 제목·유형·세부 내용을 확인하세요.');
 }
 // Stable sorting retains the explicit newest-first order within the same day.
 return [...entries].sort((a,b)=>b.date.localeCompare(a.date));
}
function render(entries,limit=Infinity){
 return '<div class="patch-list">'+validate(entries).slice(0,limit).map(entry=>`<details class="patch-note" id="${escape(entry.id)}"><summary><time datetime="${entry.date}">${entry.date.replaceAll('-','.')}</time><span class="patch-type ${entry.type}">${TYPES[entry.type]}</span><span class="patch-title">${escape(entry.title)}</span><span class="patch-chevron" aria-hidden="true">⌄</span></summary><div class="patch-body"><ul>${entry.details.map(detail=>'<li>'+escape(detail)+'</li>').join('')}</ul></div></details>`).join('')+'</div>';
}
module.exports={validate,render};
