(function(root){'use strict';
function compatible(record,version,fingerprint){return !!record&&record.version===version&&record.fingerprint===fingerprint&&!!record.payload&&!!record.ui?.counts&&['you','partner'].includes(record.payload.composeSide)&&!!record.checkpoint?.result&&Array.isArray(record.checkpoint.cells)&&Array.isArray(record.checkpoint.marks);}
const api={compatible};root.CoopRecovery=api;if(typeof module!=='undefined')module.exports=api;
if(typeof indexedDB==='undefined'){api.save=async()=>false;api.load=async()=>null;return;}
let database;function db(){return database??=new Promise(resolve=>{const request=indexedDB.open('stack-lab-recovery',1);request.onupgradeneeded=()=>request.result.createObjectStore('checkpoints');request.onsuccess=()=>resolve(request.result);request.onerror=request.onblocked=()=>resolve(null);});}
api.save=async record=>{try{const database=await db();if(!database)return false;return await new Promise(resolve=>{const tx=database.transaction('checkpoints','readwrite');tx.objectStore('checkpoints').put(record,'placement');tx.oncomplete=()=>resolve(true);tx.onerror=tx.onabort=()=>resolve(false);});}catch{return false;}};
api.load=async()=>{try{const database=await db();if(!database)return null;return await new Promise(resolve=>{const request=database.transaction('checkpoints').objectStore('checkpoints').get('placement');request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>resolve(null);});}catch{return null;}};
})(globalThis);
