const features=[
 {id:'dashboard',label:'메인 대시보드',group:'도구',pages:['/']},
 {id:'research',label:'원클릭 분석',group:'도구',pages:['/research']},
 {id:'board',label:'배치·세팅',group:'도구',pages:['/lab','/board']},
 {id:'battle-watch',label:'전투 관전',group:'도구'},
 {id:'growth',label:'다음 성장 추천',group:'성장',pages:['/growth']},
 {id:'diagnosis',label:'스테이지 진단',group:'성장',pages:['/diagnosis']},
 {id:'guide',label:'성장 로드맵',group:'성장',pages:['/guide']},
 {id:'units',label:'초마신별 보석 추천',group:'공략',pages:['/units']},
 {id:'stages',label:'스테이지 분석',group:'공략',pages:['/stages']},
 {id:'wall',label:'성벽 조합',group:'공략',pages:['/wall','/wall-sim']},
 {id:'giant',label:'거인 분석',group:'공략',pages:['/giant','/boss-sim']},
 {id:'decks',label:'덱 공략 열람',group:'공략',pages:['/decks']},
 {id:'publish-guide',label:'덱 공략 작성·수정',group:'공략'},
 {id:'demon-tiers',label:'초마신 티어리스트 열람',group:'티어리스트',pages:['/dealer-tiers']},
 {id:'demon-vote',label:'초마신 월드컵 참여·제출',group:'티어리스트'},
 {id:'demon-editor',label:'개인 초마신 티어 작성',group:'티어리스트',pages:['/dealer-tiers/create']},
 {id:'gem-tiers',label:'보석 티어리스트 열람',group:'티어리스트',pages:['/gem-tiers']},
 {id:'gem-vote',label:'보석 월드컵 참여·제출',group:'티어리스트'},
 {id:'gem-editor',label:'개인 보석 티어 작성',group:'티어리스트',pages:['/gem-tiers/create']},
 {id:'puzzle',label:'배치 퍼즐 열람·연습',group:'퍼즐·랭킹',pages:['/weekly-puzzle']},
 {id:'puzzle-submit',label:'오늘의 퍼즐 기록 제출',group:'퍼즐·랭킹'},
 {id:'weekly-submit',label:'주간 덱 챌린지 계정 제출',group:'퍼즐·랭킹',requiresAccount:true},
 {id:'puzzle-ranking',label:'퍼즐 랭킹',group:'퍼즐·랭킹',pages:['/rankings']},
 {id:'achievement-ranking',label:'업적 랭킹',group:'퍼즐·랭킹',pages:['/rankings/achievements']},
 {id:'achievement-page',label:'업적 목록 열람',group:'업적',pages:['/achievements']},
 {id:'achievements',label:'계정 업적·대표 배지',group:'업적',requiresAccount:true},
 {id:'saved-decks',label:'계정 덱 저장·불러오기',group:'계정',requiresAccount:true},
 {id:'account-settings',label:'계정 설정·성장 기록',group:'계정',requiresAccount:true},
 {id:'account-records',label:'계정 활동·분석 기록',group:'계정',requiresAccount:true},
 {id:'account-security',label:'계정 복구 기기 관리',group:'계정',requiresAccount:true},
 {id:'vault',label:'코드형 개인 저장소',group:'저장·공유'},
 {id:'shared-results',label:'공용 계산 결과 저장·조회',group:'저장·공유'},
 {id:'updates',label:'업데이트 로그',group:'기타',pages:['/updates']},
 {id:'legacy-tools',label:'기존 계산 도구',group:'기타',pages:['/dps-compare','/dps-rank','/lib-sim','/tickets','/charts']}
];
function forRequest(path,method='GET',kind='demons',challenge=''){
 try{path=decodeURIComponent(path).replace(/\/+$/,'')||'/';}catch{return [];}
 const page=path.replace(/\/index\.html$/,'').replace(/\/+$/,'')||'/';
 const feature=features.find(value=>value.pages?.includes(page));
 if(feature)return [feature.id];
 if(path==='/api/tier-votes')return method==='PUT'?[kind==='gems'?'gem-tiers':'demon-tiers',kind==='gems'?'gem-vote':'demon-vote']:[kind==='gems'?'gem-tiers':'demon-tiers'];
 if(path==='/api/deck-guides')return method==='GET'?['decks']:['decks','publish-guide'];
 if(path==='/api/weekly-puzzle')return method==='POST'?['puzzle',challenge==='weekly'?'weekly-submit':'puzzle-submit']:['puzzle'];
 if(path==='/api/visitors')return ['dashboard'];
 if(path==='/api/rankings')return ['puzzle-ranking'];
 if(path==='/api/achievement-rankings')return ['achievement-ranking'];
 if(['/api/unit-results','/api/unit-freeze-results'].includes(path))return ['units'];
 if(path==='/api/calculation-results')return ['shared-results'];
 if(path.startsWith('/api/vault'))return ['vault'];
 if(path.startsWith('/api/me/decks'))return ['saved-decks'];
 if(['/api/me/settings','/api/me/progress','/api/account/board'].includes(path))return ['account-settings'];
 if(['/api/me/activity','/api/me/analysis'].includes(path))return ['account-records'];
 if(path.startsWith('/api/devices'))return ['account-security'];
 if(path==='/api/me/achievements'&&method==='GET')return ['achievement-page'];
 if(path==='/api/me/battle-discovery')return ['battle-watch','achievements'];
 if(['/api/me/featured-badge','/api/me/achievements','/api/me/achievement-notices','/api/me/archive-discovery'].includes(path))return ['achievements'];
 return [];
}
module.exports={features,forRequest};
