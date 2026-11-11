(()=>{
 'use strict';
 const save=document.getElementById('fortune-save'),share=document.getElementById('fortune-share');
 const status=document.getElementById('fortune-image-status'),dialog=document.getElementById('fortune-export');
 const preview=document.getElementById('fortune-preview'),download=document.getElementById('fortune-download');
 const openImage=document.getElementById('fortune-image-open');
 let serial=0,current=null,file=null,imageUrl=null,canShareFile=false;
 function reset(){
  serial++;
  current=null;
  file=null;
  canShareFile=false;
  if(imageUrl)URL.revokeObjectURL(imageUrl);
  imageUrl=null;
  preview.removeAttribute('src');
  download.removeAttribute('href');
  openImage.removeAttribute('href');
  if(dialog.open)dialog.close();
  save.disabled=true;
  share.disabled=true;
  status.textContent='';
 }
 function image(src){
  return new Promise((resolve,reject)=>{
   const value=new Image();
   value.onload=()=>resolve(value);
   value.onerror=()=>reject(Error('보석 이미지를 불러오지 못했어요. 다시 시도해 주세요.'));
   value.src=src;
  });
 }
 async function render(reading){
  await document.fonts.ready;
  const [stone,glyph]=await Promise.all([
   image('/assets/gems/stone-'+reading.grade.toLowerCase()+'.webp'),
   image('/assets/gems/'+reading.gem+'.webp')
  ]);
  const canvas=document.createElement('canvas');
  canvas.width=1080;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('이미지를 만들 수 없어요.');
  const font='"Pretendard",sans-serif';
  function wrap(text,size,weight=400,width=876){
   ctx.font=weight+' '+size+'px '+font;
   const lines=[];
   let line='';
   for(const character of text){
    if(character==='\n'||ctx.measureText(line+character).width>width){
     lines.push(line);
     line=character==='\n'?'':character;
    }else line+=character;
   }
   if(line)lines.push(line);
   return lines;
  }
  const verdict=wrap(reading.verdict,40,800);
  const title=wrap(reading.title,34,700);
  const message=wrap(reading.message,28);
  const ritual=wrap(reading.ritual,22);
  const height=1000+verdict.length*54+title.length*48+message.length*46+ritual.length*34;
  canvas.height=height;
  const background=ctx.createLinearGradient(0,0,1080,height);
  background.addColorStop(0,'#172536');
  background.addColorStop(1,'#091321');
  ctx.fillStyle=background;
  ctx.fillRect(0,0,1080,height);
  const glow=ctx.createRadialGradient(540,250,0,540,250,650);
  glow.addColorStop(0,reading.accent+'38');
  glow.addColorStop(1,reading.accent+'00');
  ctx.fillStyle=glow;
  ctx.fillRect(0,0,1080,height);
  ctx.lineWidth=2;
  ctx.strokeStyle=reading.accent+'88';
  ctx.beginPath();
  ctx.roundRect(24,24,1032,height-48,32);
  ctx.stroke();
  ctx.textAlign='center';
  function text(value,y,size,color='#edf5ff',weight=400){
   ctx.fillStyle=color;
   ctx.font=weight+' '+size+'px '+font;
   ctx.fillText(value,540,y);
  }
  function paragraph(lines,y,size,color,weight,lineHeight){
   for(const line of lines){text(line,y,size,color,weight);y+=lineHeight;}
   return y;
  }
  text('오늘의 보석 운세',77,26,'#b8cddd',700);
  text(reading.day.replaceAll('-','. ')+' · 한국 시간',115,20,'#9fb5c8');
  ctx.save();
  ctx.shadowColor=reading.accent+'99';
  ctx.shadowBlur=48;
  ctx.drawImage(stone,452,145,176,176);
  ctx.restore();
  ctx.drawImage(glyph,471,164,138,138);
  for(const [x,y,size]of [[144,196,58],[866,308,42]]){
   ctx.save();
   ctx.globalAlpha=.55;
   ctx.drawImage(stone,x,y,size,size);
   ctx.drawImage(glyph,x+size*.11,y+size*.11,size*.78,size*.78);
   ctx.restore();
  }
  text(reading.grade+' 보석의 기운',360,24,'#c4d3e1');
  text(reading.luck,454,86,reading.accent,800);
  let y=paragraph(verdict,522,40,reading.accent,800,54)+25;
  text(reading.mood,y,22,reading.accent);
  y+=59;
  y=paragraph(title,y,34,'#f1f6ff',700,48)+25;
  y=paragraph(message,y,28,'#bfd2e1',400,46)+14;
  const boxTop=y;
  const stats=[['행운의 보석',reading.gemName],['행운의 색',reading.color],['행운의 숫자',String(reading.number)]];
  for(const [index,[label,value]]of stats.entries()){
   const x=84+index*308;
   ctx.fillStyle='#0a1929bb';
   ctx.strokeStyle=reading.accent+'66';
   ctx.lineWidth=1;
   ctx.beginPath();
   ctx.roundRect(x,boxTop,296,136,18);
   ctx.fill();
   ctx.stroke();
   ctx.font='22px '+font;
   ctx.fillStyle='#a7c0d1';
   ctx.fillText(label,x+148,boxTop+43);
   ctx.font='700 32px '+font;
   ctx.fillStyle=reading.accent;
   ctx.fillText(value,x+148,boxTop+98,260);
  }
  y=boxTop+189;
  y=paragraph(ritual,y,22,'#bfd2e1',400,34);
  text('재미로 보는 운세 · 실제 뽑기 확률과 관계없어요',height-95,19,'#92a8bd');
  text('스택 연구소  ·  STACK LAB',height-58,21,'#bbd8df',700);
  return new Promise((resolve,reject)=>{
   canvas.toBlob(blob=>blob?resolve(blob):reject(Error('이미지 저장 파일을 만들지 못했어요.')),'image/png');
  });
 }
 async function prepare(reading){
  reset();
  current=reading;
  const token=serial;
  status.textContent='저장할 운세 이미지를 만들고 있어요…';
  try{
   const blob=await render(reading);
   if(token!==serial)return;
   file=new File([blob],'stack-lab-fortune-'+reading.day+'-'+reading.grade.toLowerCase()+'.png',{type:'image/png'});
   imageUrl=URL.createObjectURL(file);
   preview.src=imageUrl;
   download.href=imageUrl;
   download.download=file.name;
   openImage.href=imageUrl;
   try{canShareFile=!!navigator.canShare?.({files:[file]});}catch{canShareFile=false;}
   share.textContent=canShareFile?'공유하기':'링크 복사';
   save.disabled=false;
   share.disabled=false;
   status.textContent='결과를 이미지로 간직하거나 친구에게 공유해 보세요.';
  }catch(error){
   if(token!==serial)return;
   save.disabled=false;
   status.textContent=error.message;
  }
 }
 save.onclick=async()=>{
  const reading=current;
  if(!file&&reading)await prepare(reading);
  if(current===reading&&file&&!dialog.open)dialog.showModal();
 };
 share.onclick=async()=>{
  if(!file)return;
  const selected=file,reading=current,token=serial;
  share.disabled=true;
  try{
   if(canShareFile){
    await navigator.share({files:[selected],title:'오늘의 보석 운세 · '+reading.luck});
    if(token!==serial)return;
    status.textContent='운세 이미지를 공유했어요.';
   }else{
    await navigator.clipboard.writeText(location.origin+'/fortune/');
    if(token!==serial)return;
    status.textContent='운세 페이지 링크를 복사했어요. 결과 이미지는 이미지 저장에서 받을 수 있어요.';
   }
  }catch(error){
   if(token!==serial)return;
   if(error.name==='AbortError')status.textContent='공유를 취소했어요.';
   else{
    status.textContent='이미지를 저장하거나 길게 눌러 공유해 주세요.';
    if(file&&!dialog.open)dialog.showModal();
   }
  }finally{share.disabled=!file;}
 };
 document.getElementById('fortune-export-close').onclick=()=>dialog.close();
 globalThis.CoopFortuneExport={prepare,reset};
})();
