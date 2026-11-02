(function(root){'use strict';
const MODES={hard:'어려움',hell:'지옥',abyss:'심연',deepsea:'심해'},BOARD_KEY='coop-lab-board-v2',GUIDES_KEY='stack-lab-deck-guides-v1';
function parse(text){if(typeof text!=='string'||text.length>2000000)throw Error('입력은 2MB 이하만 지원합니다.');return JSON.parse(text,(key,value)=>{if(['__proto__','prototype','constructor'].includes(key))throw Error('지원하지 않는 데이터 키입니다.');return value;});}
function validateDeck(state,D,G,T){
 if(!state||state.version!==2||!Array.isArray(state.cells)||!state.cells.length||state.cells.length>70||!T.TARGET_BY_ID.has(state.target)||!['normal',...Object.keys(MODES)].includes(state.mode))throw Error('배치 화면에서 저장한 유효한 덱이 필요합니다.');
 const used=new Set;for(const c of state.cells){if(!c||typeof c!=='object')throw Error('덱의 배치 형식을 확인하세요.');const key=c.row+':'+c.col;if(!Number.isInteger(c.row)||!Number.isInteger(c.col)||!G.buildable(c.row,c.col)||!D.DEMON_BY_SLUG.has(c.slug)||used.has(key))throw Error('덱의 유닛·배치 위치를 확인하세요.');used.add(key);}
 if(state.marks!==undefined){if(!Array.isArray(state.marks)||state.marks.length>40)throw Error('장판 형식을 확인하세요.');const marks=new Set;for(const mark of state.marks){if(!mark||!Number.isInteger(mark.row)||!Number.isInteger(mark.col)||!G.buildable(mark.row,mark.col)||marks.has(mark.row+':'+mark.col)||mark.storms!==undefined&&(!Number.isInteger(mark.storms)||mark.storms<0||mark.storms>4))throw Error('장판 위치와 중첩을 확인하세요.');if(mark.contract&&(!Number.isInteger(mark.contract.row)||!Number.isInteger(mark.contract.col)||!G.buildable(mark.contract.row,mark.contract.col)||(mark.contract.row>5)!==(mark.row>5)))throw Error('계약 장판 위치를 확인하세요.');marks.add(mark.row+':'+mark.col);}}
 for(const side of ['you','partner']){const p=state[side];if(!p||!p.perDemon||Array.isArray(p.perDemon))throw Error('양쪽 진영 세팅이 필요합니다.');for(const [slug,own]of Object.entries(p.perDemon)){if(!D.DEMON_BY_SLUG.has(slug)||!own||typeof own!=='object')throw Error('유닛 세팅을 확인하세요.');for(const key of ['level','lib','skinLevels'])if(own[key]!==undefined&&(!Number.isFinite(own[key])||own[key]<0||own[key]>(key==='lib'?20:key==='skinLevels'?2:D.maxLevelFor(slug))))throw Error('유닛 성장 범위를 확인하세요.');if(own.gems!==undefined&&(!Array.isArray(own.gems)||own.gems.length>3||own.gems.some(g=>!g||(g.id!==D.EMPTY_GEM_ID&&!D.GEM_BY_ID.has(g.id))||!D.GRADES.includes(g.grade))))throw Error('보석 세팅을 확인하세요.');}}
 if(!state.cells.some(c=>c.row>5))throw Error('내 진영에 유닛을 먼저 배치하세요.');return state;
}
function describeChange(before,after,kind,E,D){
 const changes=[];let slug=null;
 for(const id of new Set(before.cells.filter(c=>c.row>5).map(c=>c.slug))){const a=before.you.perDemon[id]||{},b=after.you.perDemon[id]||{};
  for(const field of ['level','lib'])if(a[field]!==b[field]){slug=id;const from=field==='lib'?E.effectiveLib(before.you,id):a.level??before.you.levelSupreme??1,to=field==='lib'?E.effectiveLib(after.you,id):b.level;changes.push({type:field,from,to,amount:to-from});}
  for(let slot=0;slot<3;slot++){const from=a.gems?.[slot]?.id?a.gems[slot]:null,to=b.gems?.[slot]?.id?b.gems[slot]:null;if(JSON.stringify(from)!==JSON.stringify(to)){slug=id;changes.push({type:'gem',slot,from,to});}}
 }
 const stackFields={claraStacks:'clara',ivyStacks:'ivy',omenSouls:'omen',spaceStacks:'space-solider',mouseStacks:'surprise-mouse',catStacks:'master-cat'};
 if(kind==='stack')for(const [field,id]of Object.entries(stackFields))if(before.you[field]!==after.you[field]){slug=id;const from=Number(before.you[field])||0,to=after.you[field];changes.push({type:'stack',field,from,to,amount:to-from});}
 if(kind==='unit'){const index=before.cells.findIndex((c,i)=>c.slug!==after.cells[i]?.slug);if(index>=0){slug=after.cells[index].slug;changes.push({type:'unit',from:before.cells[index].slug,to:slug});}}
 return{slug,changes};
}
function candidates(input,E,D,{replacement=null,stacks=true,milestones=true,recommendations=root.CoopDealerRecommendations}={}){
 const output=[],seen=new Set,original=JSON.stringify(input),add=(kind,label,detail,change)=>{const state=structuredClone(input);change(state);const key=JSON.stringify(state);if(key!==original&&!seen.has(key)){seen.add(key);output.push({kind,label,detail,...describeChange(input,state,kind,E,D),state});}};
 for(const slug of new Set(input.cells.filter(c=>c.row>5).map(c=>c.slug))){
  const own=input.you.perDemon[slug]||{},level=own.level??input.you.levelSupreme??1,lib=E.effectiveLib(input.you,slug),name=D.DEMON_BY_SLUG.get(slug).name,unlocked=[3,10,20].filter(n=>lib>=n).length;
  if(level<D.maxLevelFor(slug))add('level',name,`레벨 ${level} → ${level+1}`,s=>s.you.perDemon[slug]={...own,level:level+1});
  if(milestones&&level<D.maxLevelFor(slug)){const currentCap=E.effectiveLib({...input.you,perDemon:{...input.you.perDemon,[slug]:{...own,lib:20}}},slug);let goal=D.maxLevelFor(slug);for(let next=level+1;next<=goal;next++){const cap=E.effectiveLib({...input.you,perDemon:{...input.you.perDemon,[slug]:{...own,level:next,lib:20}}},slug);if(cap>currentCap){goal=next;break;}}if(goal>level+1)add('level',name,`다음 성장 구간 · 레벨 ${level} → ${goal}`,s=>s.you.perDemon[slug]={...own,level:goal});}
  const libCap=E.effectiveLib({...input.you,perDemon:{...input.you.perDemon,[slug]:{...own,lib:20}}},slug);
  if(!D.NO_LIBERATION.has(slug)&&lib>=0&&lib<libCap)add('lib',name,`해방 ${lib} → ${lib+1}`,s=>{s.you.perDemon[slug]={...own,lib:lib+1};if(!s.cells.some(c=>c.row>5&&c.slug===slug&&c.lib!==false&&!c.nolib)){const cell=s.cells.find(c=>c.row>5&&c.slug===slug);cell.lib=true;cell.nolib=false;}});
  if(milestones){const goal=[3,10,20].find(n=>n>lib&&n<=libCap);if(goal>lib+1)add('lib',name,`다음 보석 슬롯 · 해방 ${lib} → ${goal}`,s=>{s.you.perDemon[slug]={...own,lib:goal};if(!s.cells.some(c=>c.row>5&&c.slug===slug&&c.lib!==false&&!c.nolib)){const cell=s.cells.find(c=>c.row>5&&c.slug===slug);cell.lib=true;cell.nolib=false;}});}
  for(let i=0;i<unlocked;i++){const gem=own.gems?.[i],grade=gem?D.GRADES.indexOf(gem.grade):-1;if(gem?.id&&grade>=0&&grade<D.GRADES.length-1)add('gem',name,`보석 ${i+1}번 ${gem.grade} → ${D.GRADES[grade+1]}`,s=>{s.you.perDemon[slug]={...own,gems:structuredClone(own.gems)};s.you.perDemon[slug].gems[i].grade=D.GRADES[grade+1];});}
  const gemSets=[['기본 추천',E.recommendedGems(slug)||[]],['난이도 추천',recommendations?.modes?.[input.mode]?.rows?.find(r=>r.slug===slug)?.gems||[]]];
  for(const [source,set]of gemSets){const recommended=set.slice(0,unlocked).map((g,i)=>({...g,grade:own.gems?.[i]?.id?own.gems[i].grade:'S'}));if(!recommended.length)continue;const combined=structuredClone(own.gems||[]);recommended.forEach((g,i)=>combined[i]=g);
   add('gem',name,source+' 보석 조합 · 기존 슬롯 등급 유지 / 빈 슬롯 S 가정',s=>s.you.perDemon[slug]={...own,gems:combined});
   for(const [slot,gem]of recommended.entries()){if((own.gems||[]).some((g,i)=>i!==slot&&g?.id===gem.id))continue;const gems=structuredClone(own.gems||[]);while(gems.length<=slot)gems.push({id:'',grade:'S'});gems[slot]=gem;add('gem',name,source+` · ${slot+1}번 슬롯만 교체`,s=>s.you.perDemon[slug]={...own,gems});}
  }
  const stack={clara:['claraStacks','claraInput'],ivy:['ivyStacks','ivyInput'],omen:['omenSouls'], 'space-solider':['spaceStacks'],'surprise-mouse':['mouseStacks'],'master-cat':['catStacks']}[slug];
  if(stacks&&stack&&(!stack[1]||input.you[stack[1]]==='manual')&&!(input.omenGrowth&&['omen','surprise-mouse'].includes(slug))&&!input.fullProgress){const value=Number(input.you[stack[0]])||0,increment=Math.max(100,Math.ceil(value*.1));add('stack',name,`입력 스택 ${value} → ${value+increment} (가정 비교)`,s=>s.you[stack[0]]=value+increment);}
 }
 if(replacement){const {from,to}=replacement;if(!D.SUPREME_SLUGS.has(to)||!input.cells.some(c=>c.row>5&&c.slug===from)||from===to)throw Error('교체할 유닛을 확인하세요.');add('unit',D.DEMON_BY_SLUG.get(to).name,'내 진영의 '+D.DEMON_BY_SLUG.get(from).name+' 교체 · 교체 유닛의 저장 세팅 사용',s=>{let liberated=s.cells.some(c=>c.row>5&&c.slug===to&&c.lib!==false&&!c.nolib);s.cells=s.cells.map(c=>{if(c.row<5||c.slug!==from)return c;const active=!liberated&&c.lib!==false&&!c.nolib&&!D.NO_LIBERATION.has(to);if(active)liberated=true;return{...c,slug:to,lib:active,nolib:!active};});});}
 return output;
}
function rank(rows,baseline){return rows.map(row=>({...row,delta:row.actual-baseline,gain:baseline>0?(row.actual/baseline-1)*100:null})).sort((a,b)=>b.delta-a.delta);}
// Board actual DPS and per-unit theoretical contributions are different metrics.
function comparisonEvidence(input,before,after,slug){
 const own=result=>(result.units||[]).filter(unit=>unit.row>5&&unit.slug===slug),summary=result=>{const units=own(result);return{count:units.length,theory:units.reduce((sum,unit)=>sum+(Number.isFinite(unit.dps)?unit.dps:0),0),growth:units[0]?.stats?{level:units[0].stats.level,lib:units[0].stats.lib}:null};};
 return{scope:'whole-deck-actual',mode:input.mode,target:input.target,partnerEnabled:!!input.partnerEnabled,fullProgress:!!input.fullProgress,omenGrowth:!!input.omenGrowth,pressureContext:!!input.pressureContext,unit:slug?{slug,scope:'own-side-board-theory',before:summary(before),after:summary(after)}:null};
}
function diagnosisSummary(report,wave){const target=report.rows.find(r=>r.wave===wave),failure=report.rows.find(r=>r.cause&&r.wave<=wave),row=failure||target;if(!row?.reached)throw Error('목표 라운드 기록이 없습니다.');return{targetWave:wave,row,reachedTarget:!!target?.reached,passed:!failure&&!!target?.pass,shortfall:Number.isFinite(row.required)&&Number.isFinite(row.damage)?Math.max(0,row.required-row.damage):null,firstRisk:failure?.wave??null,lives:report.lives};}
function guide(value,D,G,T){
 if(!value||value.format!=='stack-lab-guide'||value.version!==1)throw Error('지원하지 않는 공략 코드입니다.');
 const text=(key,max,required=false)=>{const valueText=value[key];if(typeof valueText!=='string'||valueText.length>max||required&&!valueText.trim())throw Error('공략 제목·메모 길이를 확인하세요.');return valueText.trim();};
 return{format:'stack-lab-guide',version:1,title:text('title',100,true),operation:text('operation',4000),requirements:text('requirements',2000),alternatives:text('alternatives',2000),mode:Object.hasOwn(MODES,value.mode)?value.mode:(()=>{throw Error('공략 난이도를 확인하세요.');})(),wave:Number.isInteger(value.wave)&&value.wave>=1&&value.wave<=T.lastWave(value.mode)?value.wave:(()=>{throw Error('목표 라운드를 확인하세요.');})(),deck:structuredClone(validateDeck(value.deck,D,G,T))};
}
function encode(value){const bytes=new TextEncoder().encode(JSON.stringify(value));let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return 'SLG1.'+btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function decode(code){if(typeof code!=='string'||!code.startsWith('SLG1.')||code.length>2700000||!/^[\w-]+$/.test(code.slice(5)))throw Error('공략 코드를 확인하세요.');try{const binary=atob(code.slice(5).replaceAll('-','+').replaceAll('_','/'));return parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary,c=>c.charCodeAt(0))));}catch(error){throw Error('공략 코드를 읽지 못했습니다: '+error.message);}}
root.CoopJourney={MODES,BOARD_KEY,GUIDES_KEY,parse,validateDeck,describeChange,candidates,rank,comparisonEvidence,diagnosisSummary,guide,encode,decode};if(typeof module!=='undefined')module.exports=root.CoopJourney;
})(globalThis);
