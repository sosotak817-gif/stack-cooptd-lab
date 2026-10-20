const assert=require('node:assert/strict'),{load}=require('./inspect.cjs'),E=load(98018),D=load(34621),T=load(1503),H=require('./ui/unit-tools.js'),Egg=require('./ui/eggby-tools.js'),P=require('./ui/board-presets.js');
const target=T.finalBossOf('deepsea'),base={slug:'clara',account:{...P.newAccount(E,D),claraInput:'manual',claraStacks:1000,pressureLv:1},growth:{level:21,lib:20,skinLevels:2},mode:target.mode,target:target.id,targetData:target};
const pick=id=>({id,grade:'SSS'}),glacier=[pick('glacier'),pick('origin'),pick('waves')],combo=[pick('combo'),pick('origin'),pick('waves')];
const fs=require('node:fs'),vm=require('node:vm'),ui=fs.readFileSync('ui/units-page.js','utf8'),controlsSource=ui.slice(ui.indexOf('function renderControls(){'),ui.indexOf('function renderFormula(')),nodes=new Map,choices=new Map,config={growth:base.growth,conditions:{}};
const context={config,account:base.account,slug:'clara',mode:base.mode,target:base.target,T,dict:{},$:id=>{if(!nodes.has(id))nodes.set(id,{children:[],replaceChildren(){this.children=[]},append(n){this.children.push(n)}});return nodes.get(id)},option:(parent,label,options,value,change)=>choices.set(label,{value,change}),number(){},el:(tag,text)=>({tag,text})};vm.runInNewContext('('+controlsSource+')',context)();assert.equal(choices.get('빙결 조건').value,'false');choices.get('빙결 조건').change('true');assert.equal(config.conditions.frozen,true);assert.equal(config.conditions.holdShares.freeze,0);choices.get('빙결 조건').change('false');assert.equal(config.conditions.frozen,false);
(async()=>{
 for(const frozen of [false,true]){
  const input={...base,account:{...base.account,frozen}},rows=[combo,glacier].map(g=>H.row(input,g,E,D,Egg,true));
  assert.equal(rows[1].formula.inputs.glacierFinalPct,frozen?10:0);
  for(const [i,gems]of [combo,glacier].entries())assert.equal(rows[i].dps,E.computeDemon(D.DEMON_BY_SLUG.get('clara'),H.params(input,gems,E,D,Egg)).dps);
  const diff=H.difference(rows[0],rows[1]);assert.equal(diff.delta,rows[1].dps-rows[0].dps);assert.equal(diff.percent,diff.delta/rows[0].dps*100);
  assert.ok(Math.abs(diff.components.reduce((n,c)=>n+c.dps,0)-diff.delta)<Math.max(1,Math.abs(diff.delta))*1e-10);
  const limited={...D,GEMS:D.GEMS.filter(g=>['glacier','combo','waves','origin'].includes(g.id))},top=await H.top(input,E,limited,Egg),sorted=[...rows].sort(H.compareDps);
  assert.ok(top.rankings[0].dps>=sorted[0].dps,'ranked maximum cannot be below the compared Combo/Glacier rows');
  console.log('Clara',frozen?'frozen':'not frozen',{combo:rows[0].dps,glacier:rows[1].dps,delta:diff.delta,glacierFinalPct:rows[1].formula.inputs.glacierFinalPct});
 }
 const immune=T.TARGETS.find(t=>t.mode==='deepsea'&&t.type==='GiantsBoss');
 assert.equal(H.row({...base,target:immune.id,targetData:immune,account:{...base.account,frozen:true}},glacier,E,D,Egg,true).formula.inputs.glacierFinalPct,0,'giants are freeze immune');
 assert.equal(H.row({...base,account:{...base.account,frozen:true,pressureLv:5}},glacier,E,D,Egg,true).formula.inputs.glacierFinalPct,0,'pressure immunity overrides requested freeze');
 assert.equal(H.row({...base,growth:{...base.growth,lib:0},account:{...base.account,frozen:true}},glacier,E,D,Egg,true).formula.inputs.glacierFinalPct,0,'locked slot does not grant Glacier');
 const partial=H.row({...base,account:{...base.account,frozen:false,holdShares:{freeze:.4,stun:0}}},glacier,E,D,Egg,true);assert.equal(partial.formula.inputs.glacierFinalPct,4,'original damage-weighted freeze share');
 const diff=H.difference({dps:0,components:[]},{dps:0,components:[]});assert.equal(diff.percent,null);assert.equal(diff.delta,0);
 console.log('Glacier SSS: original +10 final percentage points, inactive/immune/locked/partial cases, Clara Combo comparison, exact ranking and damage summaries passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
