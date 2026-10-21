const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{load}=require('./inspect.cjs');
const source=fs.readFileSync('dist/engine.js','utf8'),start=source.indexOf('hop:(e,t,l)=>(r.benchmarkDamageScale??1)'),end=source.indexOf(',blocked:',start);
assert.ok(start>=0&&end>start,'the compiled combat adapter must expose its benchmark-aware overflow hop');
const expression=source.slice(start+4,end),original=load(4248).hopDamage,pr={bossDmg:50,hopAdd:10,def:.8};
for(const scale of [undefined,.5,1,2])for(const type of ['Monster','LineBoss']){
 const context={r:scale===undefined?{}:{benchmarkDamageScale:scale},tT:{hopDamage:original},lu:()=>({pr}),tJ:{towerAt:()=>null},eJ:{},a:{TARGET_BY_ID:new Map([['test',{scaling:10}]])}};vm.createContext(context);
 const hop=vm.runInContext('('+expression+')',context),factor=scale??1;
 // The caller already scaled overflow. The hop's separate flat/boss bonus
 // must also scale once, while overflow must not be multiplied a second time.
 const actual=hop({type,tid:'test'},{home:1,slug:'oni'},100*factor),expected=original(100,pr,type==='LineBoss',10)*factor;
 assert.equal(actual,expected);
}
console.log('Stage benchmark overflow hops: compiled combat adapter preserves default damage and scales overflow plus flat/boss bonuses exactly once for half, normal and double damage.');
