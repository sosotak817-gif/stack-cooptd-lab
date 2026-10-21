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
root.CoopRangeView={analyze,viewport,rectangle};if(typeof module!=='undefined')module.exports=root.CoopRangeView;
})(globalThis);
