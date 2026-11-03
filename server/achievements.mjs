export const achievements = [
 ['first-deck','첫 덱 저장','decks',1,'▣'],
 ['decks-3','덱 수집가','decks',3,'▤'],
 ['decks-5','덱 보관함','decks',5,'▥'],
 ['decks-10','덱 연구실','decks',10,'▦'],
 ['decks-20','덱 아카이브','decks',20,'◆'],
 ['first-guide','첫 덱 공략 발행','guides',1,'▧'],
 ['guides-3','공략 기록자','guides',3,'✎'],
 ['guides-5','공략 편집자','guides',5,'✒'],
 ['guides-10','공략 연재자','guides',10,'✦'],
 ['first-verified-puzzle','첫 검증 퍼즐 기록','daily',1,'✓'],
 ['daily-3','퍼즐 탐험가','daily',3,'◇'],
 ['daily-5','퍼즐 분석가','daily',5,'◈'],
 ['daily-10','퍼즐 숙련자','daily',10,'✶'],
 ['daily-20','퍼즐 전문가','daily',20,'✷'],
 ['first-weekly-challenge','첫 주간 덱 챌린지','weekly',1,'▩'],
 ['weekly-3','주간 도전자','weekly',3,'⚑'],
 ['weekly-5','주간 단골','weekly',5,'★'],
 ['weekly-10','주간 챌린저','weekly',10,'✪'],
 ['analysis-3','비교 연구원','analysis',3,'⌕'],
 ['analysis-10','리포트 수집가','analysis',10,'▨']
].map(([code,title,metric,target,glyph])=>({code,title,metric,target,glyph}));

const criteria = {
 decks:'계정에 저장한 덱',guides:'계정으로 발행한 공략',
 daily:'서버 검증 퍼즐 기록',weekly:'서버 검증 주간 챌린지 참여 주차',analysis:'계정에 저장한 분석 요약'
};

export function publicAchievements(counts={},earned=new Set()) {
 return achievements.map(({metric,...badge})=>{
  const current=Math.min(badge.target,counts[metric]||0);
  const complete=earned.has(badge.code);
  return {...badge,criterion:criteria[metric],current,complete,percent:complete?100:Math.floor(100*current/badge.target)};
 });
}

export async function syncAchievements(db,userId) {
 const row=await db.prepare(`SELECT
  (SELECT count(*) FROM lab_decks WHERE user_id=?) decks,
  (SELECT count(*) FROM deck_guides WHERE owner=?) guides,
  (SELECT count(*) FROM daily_puzzle_account_scores WHERE user_id=? AND revision LIKE '%:server-score-v1') daily,
  (SELECT count(DISTINCT week) FROM daily_puzzle_account_scores WHERE user_id=? AND revision LIKE '%:weekly:server-score-v1') weekly,
  (SELECT count(*) FROM lab_analysis_records WHERE user_id=?) analysis
 `).bind(userId,'account:'+userId,userId,userId,userId).first();
 const existing=await db.prepare('SELECT code FROM lab_user_achievements WHERE user_id=?').bind(userId).all();
 const earned=new Set(existing.results.map(item=>item.code));
 const pending=achievements.filter(badge=>row[badge.metric]>=badge.target&&!earned.has(badge.code));
 if(pending.length){
  await db.batch(pending.flatMap(badge=>[
   db.prepare('INSERT OR IGNORE INTO lab_achievements(code,title) VALUES (?,?)').bind(badge.code,badge.title),
   db.prepare('INSERT OR IGNORE INTO lab_user_achievements(user_id,code,earned_at) VALUES (?,?,?)').bind(userId,badge.code,Date.now())
  ]));
  for(const badge of pending)earned.add(badge.code);
 }
 return publicAchievements(row,earned);
}
