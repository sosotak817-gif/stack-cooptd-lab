const assert=require('node:assert/strict');
require('./dist/engine.js');require('./dist/dealer-recommendations.js');require('./ui/board-presets.js');
const J=require('./ui/journey-core.js'),X=require('./ui/growth-experience.js');
for(const id of Object.keys(CoopPresets.presets)){
 const input=X.example(id),before=JSON.stringify(input);J.validateDeck(input,CoopData,CoopGeometry,CoopTargets);
 assert.equal(input.mode,'hard');assert.equal(input.you.perDemon.clara.level,id==='goblin'?1:11);
 const candidates=J.candidates(input,CoopEngine,CoopData,{replacement:{from:input.cells[0].slug,to:'kaiser'}});
 for(const candidate of candidates){const applied=X.applyGoal(input,candidate);assert.deepEqual(applied,candidate.state,'exact candidate state for '+id+' '+candidate.kind+' '+candidate.detail);assert.ok(X.goalProgress(applied,candidate),'applied target reached');assert.equal(JSON.stringify(input),before,'preview leaves source untouched');assert.deepEqual(applied.partner,input.partner,'partner settings unchanged');}
}
const input=X.example(),candidates=J.candidates(input,CoopEngine,CoopData),level=candidates.find(c=>c.kind==='level');assert.ok(!X.goalProgress(input,level));const missing=structuredClone(level.state);missing.cells=missing.cells.filter(c=>c.slug!==level.slug);assert.ok(!X.goalProgress(missing,level),'missing unit cannot complete target');const lib=candidates.find(c=>c.kind==='lib'),notLiberated=structuredClone(lib.state);notLiberated.cells.filter(c=>c.slug===lib.slug).forEach(c=>{c.lib=false;c.nolib=true});assert.ok(!X.goalProgress(notLiberated,lib));assert.throws(()=>X.applyGoal(input,{changes:[{type:'stack',field:'notAStack',to:100}]}));
console.log('Growth experience: three validated examples, exact candidate parity for all growth kinds, immutable previews, unchanged partner and accurate goal completion passed.');
