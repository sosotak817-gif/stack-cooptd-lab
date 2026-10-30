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
function render(report,fmt){
 const label=side=>side==='partner'&&report.basis==='mirror'?root.StageComparison.label('you')+' 복제':side==='partner'&&report.basis==='solo'?'빈 진영':root.StageComparison.label(side);const section=el('section');section.className='stage-duel';const total=C.shares(report.rows),final=report.rows.at(-1),names=['you','partner'];
 function ratio(values){const sum=values.you+values.partner;return sum>0?names.map(s=>label(s)+' '+(100*values[s]/sum).toFixed(1)+'%').join(' / '):'피해 기록 없음';}
 section.append(el('h3','팀 딜 지분'),el('p','누적 '+ratio(total)),el('p','최종 보스: '+(!final.reached?'미도달':ratio(final.bossBySide)+(report.passed?'':' · 실패 시점까지'))),el('p','공격 유닛 소속 기준 유효 피해입니다. 지원·방감·제어의 간접 기여는 별도 점수로 환산하지 않습니다. 보호막 피해를 포함한 엔진 기록 기준이며, 재생된 체력에 대한 피해도 포함합니다.'));
 section.append(el('h3','독립 인분 · 동일 덱 2인 클리어 경계'));
 for(const side of (slots?.b?names:['you'])){const value=report.independent?.[side]||(side==='you'?report.contribution:null);const line=el('p',label(side)+': '+(value?Number.isFinite(value.people)?value.people.toFixed(1)+'인분':value.lowerBound?'최소 '+value.lowerBound.toFixed(1)+'인분':'탐색 범위 내 산출 불가':'계산 대기 중'));if(!value)line.dataset.independentPending=label(side);section.append(line);}
 section.append(el('p','각 덱을 양쪽에 복제한 연속 전투에서 피해 배율을 조정합니다. 같은 덱 2개가 딱 클리어하는 수준이 1.0인분이며, A/B 합계는 2로 고정되지 않습니다. 딜 지분과 다른 지표입니다.'));
 const heading=el('h3','라운드별 딜 지분'),select=el('select');select.setAttribute('aria-label','라운드 지분 표시 기준');select.append(new Option('해당 라운드','round'),new Option('누적 지분','cumulative'));const chart=el('div');chart.className='stage-share-chart';chart.setAttribute('role','group');chart.setAttribute('aria-label','라운드별 A B 딜 지분 막대 그래프');
 const detail=el('p','막대를 선택하면 피해량을 확인할 수 있습니다.'),table=el('details'),summary=el('summary','라운드별 피해 수치 보기'),wrap=el('div');wrap.className='stage-table-wrap';const grid=el('table');grid.className='stage-table';const head=el('tr');for(const text of ['라운드',label('you')+' 피해',label('partner')+' 피해','A / B 지분'])head.append(el('th',text));grid.append(head);
 function draw(){chart.replaceChildren();while(grid.children.length>1)grid.lastChild.remove();const running={you:0,partner:0};for(const row of report.rows){if(!row.reached)continue;const damage=row.damageBySide;for(const s of names)running[s]+=damage?.[s]||0;const value=select.value==='cumulative'?{...running}:damage,total=(value?.you||0)+(value?.partner||0),share=total>0?100*value.you/total:null,bar=el('button');bar.type='button';bar.className='stage-share-bar';bar.style.setProperty('--share',(share??0)+'%');bar.dataset.empty=String(share===null);const text=row.wave+'R · '+ratio(value||{you:0,partner:0})+' · '+label('you')+' '+fmt(value?.you||0)+' / '+label('partner')+' '+fmt(value?.partner||0);bar.title=text;bar.setAttribute('aria-label',text);bar.onclick=()=>detail.textContent=text;chart.append(bar);const tr=el('tr');for(const text of [row.wave+'R',fmt(value?.you||0),fmt(value?.partner||0),ratio(value||{you:0,partner:0})])tr.append(el('td',text));grid.append(tr);}}
 select.onchange=draw;draw();wrap.append(grid);table.append(summary,wrap);section.append(heading,select,el('p',label('you')+': 파랑 / '+label('partner')+': 주황 · 왼쪽부터 1R → 마지막 도달 라운드 · 회색: 피해 없음'),chart,detail,table);return section;
}
root.StageComparison={setup,render,label};
})(globalThis);
