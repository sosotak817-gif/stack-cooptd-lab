const fs=require('fs'),vm=require('vm'),path=require('path');
const dir='original/_next/static/immutable/chunks';
const modules=new Map(),cache=new Map(), fncache=new Map();
const ctx={globalThis:{TURBOPACK:{push(a){let ids=[];for(const x of a.slice(1)){if(typeof x==='number')ids.push(x);else if(typeof x==='function'){for(const id of ids)modules.set(id,x);ids=[]}}}}},console,URL,URLSearchParams,TextEncoder,TextDecoder,Buffer,setTimeout,clearTimeout,performance};
vm.createContext(ctx);
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.js')&&!x.startsWith('turbopack'))){try{vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx,{filename:f})}catch(e){}}
function load(id){if(cache.has(id))return cache.get(id);if(!modules.has(id))throw Error('missing '+id);if(fncache.has(modules.get(id)))return fncache.get(modules.get(id));let out={};cache.set(id,out);fncache.set(modules.get(id),out);const modObj={exports:out};const e={g:{process:{env:{}}},r:load,i:load,s(a,mod){if(mod&&mod!==id){cache.set(mod,out);}for(let j=0;j<a.length;){let k=a[j++],g;if(a[j]===0){j++;let v=a[j++];g=()=>v}else g=a[j++];Object.defineProperty(out,k,{enumerable:true,configurable:true,get:g});}},v(v){out.default=v},A:async()=>({default:{}})};modules.get(id)(e,modObj,out);if(modObj.exports!==out){out=modObj.exports;cache.set(id,out)}return out}
if(require.main===module){for(const id of modules.keys()){try{const m=load(id);let ks=Object.keys(m);if(ks.some(k=>/dps|demon|damage|calc|grade|settings/i.test(k))) console.log(id,ks.join(','));}catch(e){console.log('ERROR',id,e.message)}}}
module.exports={load,modules,cache,ctx};
