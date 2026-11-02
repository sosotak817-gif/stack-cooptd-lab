const fs=require('node:fs'),path=require('node:path');
fs.mkdirSync('dist/mobile-assistant',{recursive:true});
fs.copyFileSync('ui/mobile-assistant.html','dist/mobile-assistant/index.html');
for(const file of ['mobile-assistant.js','mobile-assistant.css','mobile-assistant-worker.js'])fs.copyFileSync(path.join('ui',file),path.join('dist',file));
// Add a discoverable link without changing the existing navigation source.
const file='dist/design-shell.js';let code=fs.readFileSync(file,'utf8');
if(!code.includes("a.textContent='모바일 도우미 · 준비'"))code+=`
(()=>{const nav=document.querySelector('.lab-sidebar nav');if(!nav||nav.querySelector('[href="/mobile-assistant/"]'))return;const a=document.createElement('a');a.href='/mobile-assistant/';a.textContent='모바일 도우미 · 준비';nav.append(a);})();
`;
fs.writeFileSync(file,code);
