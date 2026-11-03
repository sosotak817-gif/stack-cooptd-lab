import '../dist/engine.js';
import '../ui/board-presets.js';
import '../ui/gem-tools.js';
import '../ui/eggby-tools.js';

const { CoopEngine, CoopData, CoopTargets, CoopPresets, CoopEggby, CoopGemTools, CoopBoss, CoopAccount } = globalThis;

export function puzzleDps(challenge, placements) {
  const partner = CoopPresets.newAccount(CoopEngine, CoopData);
  const you = structuredClone(partner);
  for (const slug of new Set(challenge.cells.map(cell => cell.slug))) {
    you.perDemon[slug] = { ...you.perDemon[slug], level: CoopData.maxLevelFor(slug), lib: 20 };
  }
  const mode = challenge.mode;
  const target = CoopTargets.finalBossOf(mode);
  const params = account => ({
    ...CoopEggby.normalize(account, CoopEngine), mode, targetId: target.id,
    wave: target.wave, pressureLv: 1, dsPressure: []
  });
  const own = params(you);
  const other = {
    ...params(partner), traits: [], codexSS: 0, codexSSS: 0, fortuneCard: 0,
    altar: {}, otherDef: 0, partnerDef: 0
  };
  const { cells, marks } = CoopGemTools.active({ cells: placements, marks: challenge.marks, partnerEnabled: false });
  const result = CoopBoss.computeBossBoard(cells, own, {
    marks, range: {}, blackout: 'auto', builds: { you: own, partner: other }, gold: false, bounties: null
  });
  const correction = CoopGemTools.penalty(CoopAccount.spawnShredOf(own).total);
  return CoopBoss.runActual(result) * correction.factor;
}

export function verifiedPuzzleScore(challenge, cells, moves) {
  const baseline = puzzleDps(challenge, challenge.cells);
  if (!Number.isFinite(baseline) || baseline <= 0) throw new Error('Invalid puzzle baseline');
  const actual = moves ? puzzleDps(challenge, cells) : baseline;
  if (!Number.isFinite(actual) || actual < 0) throw new Error('Invalid puzzle DPS');
  return Math.round((actual / baseline - 1) * 1e8) / 1e6;
}
