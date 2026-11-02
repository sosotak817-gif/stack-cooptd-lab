// This worker never opens persistent result storage or shared/cloud compute.
Object.defineProperty(self,'indexedDB',{value:undefined});
importScripts('/board-worker.js');
