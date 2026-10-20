(function(root){'use strict';
const colors=['#d49b20','#7c8da8','#bb754f','#9160d2','#855dd2','#785ed2','#626bd0','#4e7fc5','#3e92af','#349e99'];
function badge(rank){
 const box=document.createElement('span');box.className='rank-badge';
 const numeric=Number.isInteger(rank)&&rank>0&&rank<=1000;
 const label=numeric?rank+'위':rank==='1000+'?'1000+':'등록 전';
 if(numeric&&rank<=100){
  box.classList.add(rank<=3?'rank-podium':rank<=10?'rank-top-ten':'rank-top-hundred');
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 48 52');svg.setAttribute('aria-hidden','true');svg.classList.add('rank-icon');
  const shield=document.createElementNS(ns,'path');shield.setAttribute('d','M4 11 24 3 44 11 42 34 24 49 6 34Z');shield.setAttribute('fill',rank<=10?colors[rank-1]:'#5b79bf');svg.append(shield);
  const motif=document.createElementNS(ns,'path');motif.setAttribute('d',rank<=10?'m14 13 3 7h14l3-7-6 3-4-6-4 6Z':'m12 24 5 13m19-13-5 13M10 27l7 3m21-3-7 3M13 33l7 3m15-3-7 3');motif.setAttribute('fill',rank<=10?'#fff0b5':'none');motif.setAttribute('stroke',rank<=10?'#fff0b5':'#d6e5ff');motif.setAttribute('stroke-width','2');svg.append(motif);
  const text=document.createElementNS(ns,'text');text.setAttribute('x','24');text.setAttribute('y',rank<=10?'37':'31');text.setAttribute('text-anchor','middle');text.setAttribute('fill','white');text.setAttribute('font-size',rank===100?'12':'15');text.setAttribute('font-weight','800');text.textContent=rank;svg.append(text);box.append(svg);
 }
 const text=document.createElement('span');text.textContent=label;box.append(text);return box;
}
function token(){
 let value=localStorage.getItem('stack-lab-ranking-token');
 if(!/^[a-f0-9]{64}$/.test(value||'')){value=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem('stack-lab-ranking-token',value);}
 return value;
}
function auth(){try{return {Authorization:'Bearer '+token()};}catch{return {};}}
const recordKey=(revision,deck,target)=>'stack-lab-ranking-entry:'+revision+':'+deck+':'+target;
function participated(revision,deck,target){try{return !!localStorage.getItem(recordKey(revision,deck,target));}catch{return false;}}
function remember(revision,deck,target){try{localStorage.setItem(recordKey(revision,deck,target),'1');}catch{}}
function presetFor(snapshot){
 if(snapshot.partnerEnabled)return null;
 const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
 const shape=input=>({cells:input.cells.filter(c=>c.row>5).map(c=>({row:c.row,col:c.col,slug:c.slug,lib:c.lib!==false,nolib:!!c.nolib,eggby:c.eggby||''})).sort((a,b)=>a.row-b.row||a.col-b.col),marks:(input.marks||[]).filter(m=>m.row>5).sort((a,b)=>a.row-b.row||a.col-b.col)});
 for(const [id,preset]of Object.entries(CoopPresets.presets))if(stable(shape(snapshot))===stable(shape(preset)))return id;
 return null;
}
async function request(url,options={}){
 const response=await fetch(url,{...options,cache:'no-store'});
 const data=await response.json().catch(()=>{throw Error('랭킹 API가 연결되지 않았습니다.');});
 if(!response.ok)throw Error(data.error||'랭킹 요청에 실패했습니다.');return data;
}
root.CoopRankUI={badge,token,auth,participated,remember,presetFor,request};
})(globalThis);
