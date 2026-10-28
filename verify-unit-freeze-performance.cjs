const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
require('./dist/engine.js');
const E=CoopEngine,D=CoopData,T=CoopTargets,A=CoopAccount,B=CoopBoss,H=require('./ui/unit-tools.js'),Egg=require('./ui/eggby-tools.js');
async function main(){
 const t=T.finalBossOf('deepsea'),account=structuredClone(E.DEFAULT_PARAMS);
 account.freezeSetup={enabled:true,level:21,lib:20,skinLevels:2,relicLevel:32,frostGrade:'SSS',extraSeconds:0};
 const raw={slug:'clara',mode:t.mode,target:t.id,targetData:t,growth:{level:21,lib:20,skinLevels:2,relicLevel:32},account},before=JSON.stringify(raw);
 let iceCalls=0,holdCalls=0,candidates=0,suppressionCount=0;
 const checked={...E,computeDemon(d,p){if(d.slug==='ice-knight')iceCalls++;else candidates++;const r=E.computeDemon(d,p);assert.ok(Number.isFinite(r.dps));if(d.slug==='clara'&&p.perDemon.clara.gems.some(g=>g.id==='suppression'))suppressionCount++;return r;}},boss={...B,standingHold(...args){holdCalls++;return B.standingHold(...args);}};
 let at=performance.now();const input=H.prepareFreeze(raw,checked,D,Egg,{T,A,B:boss}),prepareMs=performance.now()-at;
 assert.equal(iceCalls,1);assert.equal(holdCalls,1);assert.ok(input.freezeProfile.stunShare>0);
 const suppression=[{id:'suppression',grade:'SSS'}],glacier=[{id:'glacier',grade:'SSS'}],manual=stun=>({...input,account:{...input.account,holdShares:{stun}}});
 const row=H.row(input,suppression,E,D,Egg,true);
 assert.equal(row.formula.inputs.stunShare,input.freezeProfile.stunShare);
 assert.ok(Math.abs(row.formula.inputs.suppressionFinalPct-10*input.freezeProfile.stunShare)<1e-10);
 assert.ok(row.dps>H.row(manual(0),suppression,E,D,Egg).dps);
 assert.equal(H.row(input,glacier,E,D,Egg).dps,H.row(manual(0),glacier,E,D,Egg).dps,'stun must not change glacier-only damage');
 assert.equal(H.params(manual(.4),suppression,E,D,Egg).holdShares.stun,.4);
 const unprepared={...raw,account:{...account,freezeSetup:{enabled:false},freezeDamagePercent:25}};
 assert.equal(H.params(unprepared,suppression,E,D,Egg).holdShares.stun,0,'manual freeze remains safe without a stun share');
 for(const mode of ['normal','hard','hell','abyss','deepsea']){
  const target=T.finalBossOf(mode),current={...raw,mode,target:target.id,targetData:target},basis=H.freezeBasis(current,E,D,Egg),expected=B.standingHold(basis.cc.map(cc=>({cc,w:1})),B.stunImmunity(target)),prepared=H.prepareFreeze(current,E,D,Egg);
  assert.equal(prepared.freezeProfile.stunShare,expected.stun);assert.equal(prepared.freezeProfile.share,expected.freeze);
  assert.equal(prepared.freezeProfile.stunShare,H.prepareFreeze({...current,account:{...account,freezeSetup:{...account.freezeSetup,extraSeconds:30}}},E,D,Egg).freezeProfile.stunShare,'extra freeze seconds do not lengthen stuns');
 }
 const noLib=H.prepareFreeze({...raw,account:{...account,freezeSetup:{...account.freezeSetup,lib:0,relicLevel:0}}},E,D,Egg);
 assert.equal(noLib.freezeProfile.share,0);assert.ok(noLib.freezeProfile.stunShare>0,'Absolute Zero stuns before liberation');
 const pressure=H.prepareFreeze({...raw,account:{...account,pressureLv:5}},E,D,Egg);assert.equal(pressure.freezeProfile.share,0);assert.equal(pressure.freezeProfile.stunShare,0);
 const immuneTarget=T.TARGETS.find(t=>!T.holdable(t));assert.ok(immuneTarget);assert.equal(H.prepareFreeze({...raw,mode:immuneTarget.mode,target:immuneTarget.id,targetData:immuneTarget},E,D,Egg).freezeProfile.stunShare,0);
 const basis=H.freezeBasis(raw,E,D,Egg),cooldown={immune:5,cooldown:3};assert.equal(H.solveFreeze({...basis,stunImmunity:cooldown}).stunShare,B.standingHold(basis.cc.map(cc=>({cc,w:1})),cooldown).stun);
 at=performance.now();const full=await H.top(input,checked,D,Egg),elapsedMs=performance.now()-at;
 assert.equal(full.evaluated,6090);assert.equal(candidates,6090);assert.equal(suppressionCount,406);assert.equal(iceCalls,1,'never recompute Ice Knight per gem candidate');assert.equal(holdCalls,1,'never solve control uptime per gem candidate');
 for(const r of full.rankings)assert.equal(r.dps,H.row(input,r.gems,E,D,Egg,true).dps);
 assert.equal(JSON.stringify(raw),before);
 const page=fs.readFileSync('ui/units-page.js','utf8'),start=page.indexOf('function renderFreezeProfile('),end=page.indexOf('\n',start),box={};vm.runInNewContext('('+page.slice(start,end)+')',{$:()=>box})(input.freezeProfile);assert.ok(box.textContent.includes('기절 비율'));assert.ok(box.textContent.includes('기본 공격 기절'));
 console.log({prepareMs,elapsedMs,evaluated:candidates,suppressionCount,iceCalls,holdCalls,stunShare:input.freezeProfile.stunShare,freezeShare:input.freezeProfile.share,top:full.rankings.map(r=>r.key)});
 if(process.argv.includes('--benchmark')){at=performance.now();await H.top(manual(0),E,D,Egg);console.log({freezeOnlyMs:performance.now()-at});}
 console.log('Joint stun/freeze: original standingHold parity, modes, immunity, pre-liberation stun, suppression damage, immutable inputs and one shared solve for 6090 candidates passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
