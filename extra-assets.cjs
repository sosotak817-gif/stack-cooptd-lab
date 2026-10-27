const fs=require('fs'),{load}=require('./inspect.cjs');const db=load(34621),board=load(56584);console.log(Object.keys(board).join(','));let paths=new Set(db.DEMONS.map(d=>'/assets/units/'+d.img+'.webp'));
paths.add('/assets/units/kaiser.webp');paths.add('/assets/relics/kaiser.webp');
for(const d of db.DEMONS){for(const lib of [null,1,11,20])try{paths.add(board.tileSprite(d.slug,{lib}));paths.add(board.tileSprite(d.slug,{lib,claraRocket:true,claraFocus:true}))}catch{}}
for(const size of board.BOARD_SIZES)for(const bg of size.backgrounds)paths.add(board.mapSprite(bg.id));
for(const v of Object.values(board))if(Array.isArray(v))for(const row of v){if(row&&typeof row==='object'){for(const k of ['img','sprite'])if(row[k])paths.add('/assets/units/'+row[k]+'.webp');if(row.id&&row.layout)paths.add('/assets/maps/'+row.id+'.webp')}}
for(const id of ['axe','blade','claw','core','eye','feather','wind',...db.DEMONS.filter(x=>['Supreme Demon God','Demon God'].includes(x.rarity)).map(x=>x.slug)])paths.add('/assets/relics/'+id+'.webp');for(const grade of ['c','b','a','s','ss','sss'])paths.add('/assets/gems/grade-'+grade+'.webp');
fs.writeFileSync('extra-assets.json',JSON.stringify([...paths]));console.log(paths.size);
