(function(root){'use strict';
const key=c=>c.row+':'+c.col,side=c=>c.row>5?'you':'partner';
function analyze({cells,units=[],builds,partnerEnabled=false},{E,R,G,Dark}){
 const active=cells.filter(c=>partnerEnabled||side(c)==='you'),rows=active.map(cell=>{
  const unit=units.find(u=>u.row===cell.row&&u.col===cell.col),p={...builds[side(cell)],pressureLv:1,dsPressure:[]},lib=unit?.stats?.lib??(cell.nolib?0:Math.max(0,E.effectiveLib(p,cell.slug))),liberated=unit?.liberated??(!cell.nolib&&lib>0),range=unit?.range&&typeof unit.range==='object'?unit.range:R.towerRange(cell.slug,p,liberated,{});
  return{cell,lib,liberated,range,at:G.tileWorld(cell.row,cell.col)};
 });
 const mice=rows.filter(r=>r.cell.slug==='surprise-mouse'&&R.holdsSpot({mouse:{},liberated:r.liberated},r.lib)).map(r=>({...r,mouse:{state:R.AWAKE}})),receivers=[];
 for(const row of rows){
  const sources=mice.filter(m=>R.chebyshev(m.at,row.at)<=R.SPOTLIGHT_REACH+1e-9),eligible=!row.range.fixed&&!row.range.contract&&!row.range.dominion,lit=eligible&&sources.length>0;
  if(lit)receivers.push({row:row.cell.row,col:row.cell.col,slug:row.cell.slug,base:row.range.range,awake:R.litRange(row.range,true),sources:sources.map(m=>({row:m.cell.row,col:m.cell.col}))});
 }
 const zones=rows.filter(r=>r.cell.slug==='omen'&&r.liberated&&r.lib>=6).map(r=>{
  const receiver=receivers.find(c=>key(c)===key(r.cell)),random=!!r.range.dominion,base=random?R.DOMINION_BAND[1]:r.range.range;
  return{row:r.cell.row,col:r.cell.col,base,awake:receiver?.awake??base,half:Dark.darkZone(base),awakeHalf:Dark.darkZone(receiver?.awake??base),boosted:!!receiver,random,band:random?[...R.DOMINION_BAND]:null};
 });
 return{mice:mice.map(r=>({row:r.cell.row,col:r.cell.col})),receivers,zones};
}
function viewport(team,full=false){return full?{start:0,rows:11}:{start:team==='you'?5:0,rows:6};}
function rectangle(zone,view,awake=false){const half=awake?zone.awakeHalf:zone.half;return{left:(zone.col+.5-half)/7*100,top:(zone.row-view.start+.5-half)/view.rows*100,width:half*2/7*100,height:half*2/view.rows*100};}
function enemyPaths(Boss){return ['you','partner'].flatMap(team=>[false,true].map(flying=>({team,flying,points:Boss.lanePath(team,flying,{hx:.25,hy:.25}).pts})));}
function pathImage(paths,view){const point=p=>({x:(p.x+3.5)/7*700,y:(5.5-p.y-view.start)/view.rows*600});return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 600" preserveAspectRatio="none">'+paths.map(path=>{const pts=path.points.map(point),first=pts[0],color=path.flying?'#ffb454':'#59e5ff';return '<polyline points="'+pts.map(p=>p.x+','+p.y).join(' ')+'" fill="none" stroke="'+color+'" stroke-width="4" stroke-linejoin="round" '+(path.flying?'stroke-dasharray="10 7"':'')+'/>'+ (first.y>=0&&first.y<=600?'<circle cx="'+Math.max(8,Math.min(692,first.x))+'" cy="'+Math.max(8,Math.min(592,first.y))+'" r="8" fill="'+color+'" stroke="#30243e" stroke-width="2"/>':'');}).join('')+'</svg>');}
root.CoopRangeView={analyze,viewport,rectangle,enemyPaths,pathImage};if(typeof module!=='undefined')module.exports=root.CoopRangeView;
})(globalThis);
