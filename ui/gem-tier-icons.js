(()=>{'use strict';
const key='stack-lab-gem-tier-icon-style-v1',controls=[];let mode='gem';try{if(localStorage.getItem(key)==='white')mode='white';}catch{}
const apply=()=>{document.body.dataset.gemIconStyle=mode;for(const control of controls)control.value=mode;};
function mount(host,id,onChange){const label=document.createElement('label');label.className='gem-icon-style';label.textContent='보석 아이콘 ';const select=document.createElement('select');select.id=id;for(const [value,text]of [['gem','보석 아이콘'],['white','하얀색 아이콘']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}label.append(select);host.append(label);controls.push(select);select.onchange=()=>{mode=select.value;try{localStorage.setItem(key,mode);}catch{}apply();onChange?.();};apply();}
function portrait(slug,name=''){const icon=document.createElement('span');icon.className='worldcup-gem-icon';icon.setAttribute('role','img');icon.setAttribute('aria-label',name);for(const id of ['stone-sss',slug]){const img=document.createElement('img');img.src='/assets/gems/'+id+'.webp';img.alt='';img.draggable=false;icon.append(img);}return icon;}
const image=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('보석 이미지를 불러오지 못했습니다. 다시 시도해 주세요.'));img.src=src;});
async function load(slug,style=mode){const [glyph,stone]=await Promise.all([image('/assets/gems/'+slug+'.webp'),style==='gem'?image('/assets/gems/stone-sss.webp'):null]);const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');if(stone)ctx.drawImage(stone,0,0,128,128);ctx.drawImage(glyph,128*.11,128*.11,128*.78,128*.78);return canvas;}
function busy(value){for(const control of controls)control.disabled=value;}
apply();globalThis.CoopGemTierIcons={mount,portrait,load,busy,get mode(){return mode;}};
})();
