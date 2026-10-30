(function(root){'use strict';
const C=root.CoopStageCompare,key='stack-lab-stage-decks-v1';let slots=null,box=null;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function saved(){const s=JSON.parse(localStorage.getItem('coop-lab-board-v2'));return CoopPresets.withDefaults(s,CoopEngine,CoopData);}
function setup(base,changed){
 if(!slots){try{const value=JSON.parse(localStorage.getItem(key));if(value?.a?.cells?.length&&value.a.account?.perDemon&&(!value.b||value.b.cells?.length&&value.b.account?.perDemon))slots=value;}catch{}slots??={a:C.extract(base,'you'),b:CoopPresets.hasPartnerDeck(base)?C.extract(base,'partner'):null};}
 if(!box){box=el('div');box.className='stage-deck-slots';document.querySelector('#saved-summary').after(box);}
 function update(refresh=true){try{localStorage.setItem(key,JSON.stringify(slots));}catch{document.querySelector('#stage-status').textContent='비교 덱을 이 세션에서만 보관합니다.';}if(refresh)changed();}
 box.replaceChildren();for(const id of ['a','b']){const card=el('section'),title=el('label','덱 '+id.toUpperCase()+' 이름 '),name=el('input');name.value=slots[id]?.name||'덱 '+id.toUpperCase();name.maxLength=40;name.oninput=()=>{if(slots[id]){slots[id].name=name.value.trim()||'덱 '+id.toUpperCase();update(false);}};name.onchange=()=>update();title.append(name);card.append(title);
 const preview=el('div');preview.className='stage-preview';for(const cell of slots[id]?.cells||[]){const unit=CoopData.DEMON_BY_SLUG.get(cell.slug);if(!unit)continue;const image=el('img');image.src='/assets/units/'+unit.img+'.webp';image.alt=cell.slug;preview.append(image);}card.append(preview,el('p',slots[id]?slots[id].cells.length+'개체 · 배치·계정·보석·제단·소환/해방 시점 포함':'미설정 · 기존 파트너 미설정 기준 사용'));
 for(const side of ['you','partner']){const button=el('button','저장된 '+(side==='you'?'내 진영':'파트너')+' 불러오기');button.type='button';button.onclick=()=>{try{const next=C.extract(saved(),side);next.name=name.value;slots[id]=next;update();}catch(error){document.querySelector('#stage-status').textContent=error.message;}};card.append(button);}
 if(id==='b'){const clear=el('button','B 비우기');clear.onclick=()=>{slots.b=null;update();};card.append(clear);}box.append(card);}
 const swap=el('button','A ↔ B 자리 교환');swap.disabled=!slots.b;swap.onclick=()=>{[slots.a,slots.b]=[slots.b,slots.a];update();};box.append(swap,el('p','배치 화면에서 세팅을 저장한 뒤 원하는 슬롯만 다시 불러오세요. 비교 슬롯은 이 브라우저에 따로 보관됩니다.'));
 return C.combine(base,slots.a,slots.b);
}
const label=side=>(side==='you'?slots?.a?.name:slots?.b?.name)||(side==='you'?'덱 A':'덱 B');
const views=new Map;
function resetViews(){views.clear();}
function render(report,fmt,dict={}){
 const viewKey=report.mode+':'+report.altar;
 if(!views.has(viewKey))views.set(viewKey,{kind:'all',axis:'round',scope:'all',side:'all',wave:null,unitsOpen:true});
 const state=views.get(viewKey),names=['you','partner'],kinds={all:'전체',mob:'일반몹',boss:'보스',other:'기타'},hasDetails=report.damageSchema>=2;
 const label=side=>side==='partner'&&report.basis==='mirror'?root.StageComparison.label('you')+' 복제':side==='partner'&&report.basis==='solo'?'빈 진영':root.StageComparison.label(side);
 const section=el('section');section.className='stage-duel';
 const ratio=values=>{const sum=values.you+values.partner;return sum>0?names.map(s=>label(s)+' '+(100*values[s]/sum).toFixed(1)+'%').join(' / '):'피해 기록 없음';};
 const percent=v=>v===null?'—':(v*100).toFixed(1)+'%';
 function makeTable(headers){const wrap=el('div'),table=el('table'),head=el('thead'),tr=el('tr'),body=el('tbody');wrap.className='stage-table-wrap';table.className='stage-table';for(const text of headers){const th=el('th',text);th.scope='col';tr.append(th);}head.append(tr);table.append(head,body);wrap.append(table);return{wrap,table,body};}
 const targetLabel=el('label','피해 대상 '),target=el('select');target.setAttribute('aria-label','딜 지분 대상 필터');
 for(const kind of ['all','mob','boss',...(C.shares(report.rows,'other').you+C.shares(report.rows,'other').partner>0?['other']:[])])target.append(new Option(kinds[kind],kind));
 target.value=state.kind;target.disabled=!hasDetails;targetLabel.append(target);
 const totalLine=el('p');totalLine.className='stage-filter-total';totalLine.setAttribute('aria-live','polite');const final=report.rows.at(-1);
 section.append(el('h3','팀 딜 지분'),targetLabel,totalLine,el('p','최종 보스 (대상 필터와 별도): '+(!final.reached?'미도달':ratio(final.bossBySide)+(report.passed?'':' · 실패 시점까지'))),el('p','실제로 맞은 적 기준입니다. 일반몹에는 심해 정기 특수몹을 포함하며, 보스 라운드의 잔존 일반몹 피해도 분리합니다. 보호막·재생 체력 피해를 포함한 엔진 기록 기준이며 지원·방감·제어의 간접 기여는 점수로 환산하지 않습니다.'));
 section.append(el('h3','독립 인분 · 동일 덱 2인 클리어 경계'));
 for(const side of (report.basis==='partner'?names:['you'])){const value=report.independent?.[side]||(side==='you'?report.contribution:null),line=el('p',label(side)+': '+(value?Number.isFinite(value.people)?value.people.toFixed(1)+'인분':value.lowerBound?'최소 '+value.lowerBound.toFixed(1)+'인분':'탐색 범위 내 산출 불가':'계산 대기 중'));if(!value)line.dataset.independentPending=label(side);section.append(line);}
 section.append(el('p','각 덱을 양쪽에 복제한 연속 전투에서 피해 배율을 조정합니다. 같은 덱 2개가 딱 클리어하는 수준이 1.0인분이며 A/B 합계는 고정되지 않습니다. 독립 인분은 피해 대상 필터와 관계없이 전체 전투 기준입니다.'));
 if(!hasDetails)section.append(el('p','상세 피해 기록이 없는 이전 결과입니다. 다시 분석하면 대상 필터와 유닛 상세를 사용할 수 있습니다.'));
 const phaseBox=el('div');phaseBox.className='stage-phase-grid';section.append(el('h3','초반 · 중반 · 후반 요약'),el('p','최종 '+report.lastWave+'라운드를 기준으로 3등분합니다. 실패한 뒤의 라운드는 미도달로 표시하며, 피해 대상 필터가 요약·그래프·유닛 상세에 함께 적용됩니다.'),phaseBox);
 const axis=el('select');axis.setAttribute('aria-label','라운드 지분 표시 기준');axis.append(new Option('해당 라운드','round'),new Option('누적 지분','cumulative'));axis.value=state.axis;
 const chart=el('div');chart.className='stage-share-chart';chart.setAttribute('role','group');chart.setAttribute('aria-label','라운드별 A B 딜 지분 막대 그래프');
 const detail=el('p','막대를 선택하면 해당 라운드의 유닛별 피해를 확인할 수 있습니다.');detail.className='stage-share-selection';detail.setAttribute('aria-live','polite');
 const rounds=makeTable(['라운드',label('you')+' 피해',label('partner')+' 피해','A / B 지분']),roundDetails=el('details');roundDetails.open=!!state.roundsOpen;roundDetails.ontoggle=()=>state.roundsOpen=roundDetails.open;roundDetails.append(el('summary','라운드별 피해 수치 보기'),rounds.wrap);
 section.append(el('h3','라운드별 딜 지분'),axis,el('p',label('you')+': 파랑 / '+label('partner')+': 주황 · 왼쪽부터 1R → 마지막 도달 라운드 · 회색: 선택 대상 피해 없음'),chart,detail,roundDetails);
 const unitsDetails=el('details');unitsDetails.className='stage-unit-details';unitsDetails.open=state.unitsOpen;unitsDetails.ontoggle=()=>state.unitsOpen=unitsDetails.open;
 unitsDetails.append(el('summary','유닛별 딜 상세 · 배치별'));
 const controls=el('div');controls.className='stage-detail-controls';const scopeLabel=el('label','구간 '),scope=el('select');scope.setAttribute('aria-label','유닛 상세 구간');scope.append(new Option('전체 도달 구간','all'));for(const p of C.phases(report.lastWave))scope.append(new Option(p.name+' '+p.from+'~'+p.to+'R',p.id));const chosenOption=new Option('선택 라운드','round');scope.append(chosenOption);scopeLabel.append(scope);
 const sideLabel=el('label','진영 '),side=el('select');side.setAttribute('aria-label','유닛 상세 진영');side.append(new Option('양쪽 진영','all'),...names.map(s=>new Option(label(s),s)));side.value=state.side;sideLabel.append(side);controls.append(scopeLabel,sideLabel);
 const unitNote=el('p');unitNote.className='stage-unit-scope';const unitTable=makeTable(['진영','유닛 · 위치','선택 대상 피해','덱 내 지분','팀 지분','일반몹 피해','보스 피해',...(target.querySelector('option[value="other"]')?['기타 피해']:[])]);
 unitsDetails.append(controls,unitNote,unitTable.wrap,el('p','같은 초마신도 위치별로 구분합니다. 위치는 전체 배치판의 위쪽부터 1행·왼쪽부터 1열입니다. 덱 내 지분은 해당 덱의 선택 대상 피해, 팀 지분은 양쪽 합계를 기준으로 하며 진영 필터를 바꿔도 분모는 유지됩니다. 직접 피해가 없는 지원형·미소환 유닛도 0으로 표시합니다.'));
 section.append(unitsDetails);
 function drawUnits(){
  chosenOption.disabled=state.wave===null;chosenOption.textContent=state.wave===null?'선택 라운드 (막대 선택)':state.wave+'R · 단일 라운드';scope.value=state.scope;side.value=state.side;
  unitTable.body.replaceChildren();const rows=C.rangeRows(report,state.scope,state.wave),units=C.unitBreakdown(report,state.kind,state.scope,state.wave),phase=C.phases(report.lastWave).find(p=>p.id===state.scope),range=state.scope==='round'?state.wave+'R':phase?phase.name+' '+phase.from+'~'+phase.to+'R':'전체 도달 구간';
  unitNote.textContent=kinds[state.kind]+' · '+range+' · '+(rows.length?rows[0].wave+'~'+rows.at(-1).wave+'R 기록':'미도달')+' · 선택 피해가 큰 순서';
  if(!hasDetails||!rows.length||!units.length){const tr=el('tr'),td=el('td',!hasDetails?'다시 분석하면 유닛 상세가 표시됩니다.':!rows.length?'이 구간은 미도달입니다.':'배치된 유닛 기록이 없습니다.');td.colSpan=8;tr.append(td);unitTable.body.append(tr);return;}
  for(const u of units.filter(u=>state.side==='all'||u.side===state.side)){const tr=el('tr');tr.dataset.unit=u.id;tr.dataset.side=u.side;tr.append(el('td',label(u.side)));const identity=el('td'),d=root.CoopData?.DEMON_BY_SLUG.get(u.slug),name=dict[d?.name]||d?.name||u.slug;if(d){const img=el('img');img.src='/assets/units/'+d.img+'.webp';img.alt='';img.loading='lazy';identity.append(img);}identity.append(el('span',name+' · '+(u.row+1)+'행 '+(u.col+1)+'열'));tr.append(identity);for(const text of [fmt(u.damage),percent(u.deckShare),percent(u.teamShare),fmt(u.mob),fmt(u.boss),...(target.querySelector('option[value="other"]')?[fmt(u.other)]:[])])tr.append(el('td',text));unitTable.body.append(tr);}
 }
 function showUnits(scopeId,wave=null){state.scope=scopeId;if(wave!==null)state.wave=wave;unitsDetails.open=state.unitsOpen=true;drawUnits();}
 function draw(){
  state.kind=target.value;state.axis=axis.value;const total=C.shares(report.rows.filter(r=>r.reached),state.kind);totalLine.textContent=kinds[state.kind]+' 누적 · '+ratio(total)+' · 합계 '+fmt(total.you+total.partner);
  phaseBox.replaceChildren();for(const p of C.phaseSummary(report,state.kind)){const card=el('section');card.className='stage-phase-card';card.dataset.phase=p.id;card.append(el('h4',p.name+' · '+p.from+'~'+p.to+'R'),el('strong',p.reached?ratio(p.damage):'미도달'),el('p',p.reached?p.reached+' / '+(p.to-p.from+1)+'라운드 도달 · 합계 '+fmt(p.damage.you+p.damage.partner):'이 구간에 도달하기 전에 전투가 종료되었습니다.'));const button=el('button',p.name+' 유닛 보기');button.type='button';button.disabled=!p.reached||!hasDetails;button.onclick=()=>showUnits(p.id);card.append(button);phaseBox.append(card);}
  chart.replaceChildren();rounds.body.replaceChildren();const running={you:0,partner:0};for(const row of report.rows){if(!row.reached)continue;const damage=C.damageOf(row,state.kind);for(const s of names)running[s]+=damage[s]||0;const value=state.axis==='cumulative'?{...running}:damage,sum=value.you+value.partner,share=sum>0?100*value.you/sum:null,bar=el('button');bar.type='button';bar.className='stage-share-bar';bar.style.setProperty('--share',(share??0)+'%');bar.dataset.empty=String(share===null);bar.setAttribute('aria-pressed',String(state.wave===row.wave));
   const text=row.wave+'R · '+kinds[state.kind]+' '+(state.axis==='cumulative'?'누적':'해당 라운드')+' · '+ratio(value)+' · '+label('you')+' '+fmt(value.you)+' / '+label('partner')+' '+fmt(value.partner);bar.title=text;bar.setAttribute('aria-label',text);bar.onclick=()=>{state.wave=row.wave;for(const b of chart.children)b.setAttribute('aria-pressed',String(b===bar));detail.textContent=text;showUnits('round',row.wave);};chart.append(bar);if(state.wave===row.wave)detail.textContent=text;const tr=el('tr');for(const text of [row.wave+'R',fmt(value.you),fmt(value.partner),ratio(value)])tr.append(el('td',text));rounds.body.append(tr);
  }
  drawUnits();
 }
 target.onchange=draw;axis.onchange=draw;scope.onchange=()=>{state.scope=scope.value;drawUnits();};side.onchange=()=>{state.side=side.value;drawUnits();};draw();return section;
}
root.StageComparison={setup,render,label,resetViews};
})(globalThis);
