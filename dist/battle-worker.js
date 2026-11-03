const version = new URL(self.location.href).search;
importScripts('/board-worker.js' + version);

// Replay needs the raw engine result, which the regular DPS cache does not retain.
// This dedicated worker only handles one calculation and never accesses that cache.
Object.defineProperty(self, 'indexedDB', { value: undefined });
const calculateMessage = self.onmessage;
const send = self.postMessage.bind(self);
const boss = self.CoopBoss;
let run;

self.CoopBoss = {
 ...boss,
 computeBossBoard(cells, account, options) {
  const held = {};
  if (cells.some(cell => cell.slug === 'omen')) {
   const target = CoopTargets.finalBossOf('deepsea');
   const builds = Object.fromEntries(Object.entries(options.builds).map(([side, build]) =>
    [side, { ...build, mode: target.mode, wave: target.wave, targetId: target.id, omenLordMode: 'off' }]));
   const growth = boss.bossRun(cells, builds.you, { ...options, builds });
   for (const cell of cells.filter(cell => cell.slug === 'omen')) {
    const home = cell.row * 7 + cell.col;
    const stock = { ...growth?.banks?.held?.[home], lord: false, lock: 0 };
    stock.souls ??= 0;
    if (!cell.nolib && cell.lib !== false && CoopEngine.effectiveLib(builds[CoopGemTools.sideOf(cell)], 'omen') >= 1) {
     CoopOmen.summonLord(stock);
    }
    held[home] = stock;
   }
  }
  run = boss.computeBossBoard(cells, account, Object.keys(held).length ?
   { ...options, held: { ...options.held, ...held } } : options);
  run.replayStock = held;
  return run;
 }
};

function battleTimeline(run, factor) {
 const clock = CoopTargets.runClock(run.target);
 const lanes = [];
 function add(kill, spawn, side, presence) {
  if (!kill || !Number.isFinite(spawn) || spawn > clock) return;
  const end = Math.max(0, Math.min(clock - spawn, kill.leak?.at ?? Infinity,
   Number.isFinite(kill.seconds) ? kill.seconds : Infinity));
  const rows = side === 'shared' ? run.plan.rows : run.units;
  const weights = boss.rowWeights(rows, run.plan.taken, run.field, run.time, presence, run.plan.away);
  const segments = (kill.segments || []).flatMap(segment => {
   const from = Math.max(0, segment.from), to = Math.min(end, segment.to);
   if (!(to > from) || !Number.isFinite(segment.rate)) return [];
   const shares = segment.rate > 0 ? weights(from, to, segment.dark, segment.phase) : [];
   const sum = shares.reduce((total, value) => total + value, 0);
   return [{
    from: from + spawn, to: to + spawn, rate: Math.max(0, segment.rate) * factor,
    phase: segment.phase, kind: segment.kind,
    attacks: sum > 0 ? rows.flatMap((unit, index) => shares[index] > 0 ? [{
     home: unit.placement.row * 7 + unit.placement.col,
     rate: segment.rate * factor * shares[index] / sum
    }] : []) : []
   }];
  });
  const duration = segments.at(-1)?.to ?? spawn;
  lanes.push({ side, spawn, duration, segments,
   cleared: Number.isFinite(kill.seconds) && kill.seconds <= end });
 }
 if (run.lanes) {
  for (const side of ['you', 'partner']) add(run[side]?.kill, run.lanes.lane(side).spawn, side, run.lanes.presence(side));
 } else add(run.kill, 0, 'shared');
 return { lanes, duration: Math.max(0, ...lanes.map(lane => lane.duration)) };
}

self.postMessage = result => {
 if (result.error) { send(result); return; }
 if (!run) { send({ id: result.id, error: '전투 타임라인을 읽지 못했어요.' }); return; }
 try {
  send({ ...result, battle: battleTimeline(run, result.correction.factor), stock: run.replayStock });
 } catch {
  send({ id: result.id, error: '유닛별 전투 기록을 계산하지 못했어요.' });
 }
};

self.onmessage = event => {
 run = null;
 const input = event.data;
 const solve = build => ({ ...build, claraInput: 'solve', ivyInput: 'solve' });
 if (input.maxBuild) Object.assign(input, CoopPresets.maxState(input, CoopEngine, CoopData), { maxBuild: false });
 return calculateMessage({ data: {
  ...input, omenGrowth: false, fullProgress: false, stackFromWaveOne: false,
  you: solve(input.you), partner: solve(input.partner)
 } });
};
