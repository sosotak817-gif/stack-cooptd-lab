const P=require('./ui/board-presets.js'),F=require('./ui/dealer-tools.js');
module.exports=function(mode){
 const {CoopEngine:E,CoopData:D,CoopTargets:T,CoopBoss:B}=globalThis,a=F.account(E,D,null,mode,{}),deck=P.presets.aclaraKaiser;
 a.mode=mode;a.targetId=T.finalBossOf(mode).id;a.installWave=1;
 for(const d of D.DEMONS)a.perDemon[d.slug]={...a.perDemon[d.slug],...F.growth(d.slug,D),installWave:1,libWave:1,gems:(E.recommendedGems(d.slug)||[]).filter(Boolean)};
 const cells=structuredClone(deck.cells);cells.push({slug:'omen',row:7,col:4,lib:true,nolib:false},{slug:'surprise-mouse',row:7,col:2,lib:true,nolib:false});
 const run=B.bossRun(cells,a,{marks:structuredClone(deck.marks),range:{},blackout:'auto',builds:{you:a,partner:structuredClone(a)},gold:false,bounties:null});
 const held=run?.banks?.held;if(!held)throw Error(mode+': stack simulation did not produce banks');
 const omen=held[53],mouse=held[51];
 if(run.gameOver)throw Error(mode+': reference deck failed at wave '+run.gameOver.wave);
 const account={omenSouls:Math.max(0,omen?.lord?omen.lock:omen?.souls||0),omenLord:!!omen?.lord,mouseStacks:Math.max(0,mouse?.spotlight||0),claraInput:'solve',ivyInput:'solve'};
 if(!Number.isFinite(account.omenSouls)||!Number.isFinite(account.mouseStacks))throw Error('Invalid calculated stacks');
 return{method:'reference-deck-wave-one',deck:'aclaraKaiser+omen+surprise-mouse',installWave:1,targetWave:T.finalBossOf(mode).wave,account,cells,marks:structuredClone(deck.marks),note:'오멘·깜짝쥐는 기준 덱의 최종 보스 진입 누적값, 클라라·아이비는 보스 전투 중 자동 성장 계산'};
};
