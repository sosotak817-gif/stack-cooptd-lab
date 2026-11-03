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
 computeBossBoard(...args) {
  run = boss.computeBossBoard(...args);
  return run;
 }
};

function battleTimeline(run, factor) {
 const clock = CoopTargets.runClock(run.target);
 const lanes = [];
 function add(kill, spawn, side) {
  if (!kill || !Number.isFinite(spawn) || spawn > clock) return;
  const end = Math.max(0, Math.min(clock - spawn, kill.leak?.at ?? Infinity,
   Number.isFinite(kill.seconds) ? kill.seconds : Infinity));
  const segments = (kill.segments || []).flatMap(segment => {
   const from = Math.max(0, segment.from), to = Math.min(end, segment.to);
   return to > from && Number.isFinite(segment.rate) ? [{
    from: from + spawn, to: to + spawn, rate: Math.max(0, segment.rate) * factor,
    phase: segment.phase, kind: segment.kind
   }] : [];
  });
  const duration = segments.at(-1)?.to ?? spawn;
  lanes.push({ side, spawn, duration, segments,
   cleared: Number.isFinite(kill.seconds) && kill.seconds <= end });
 }
 if (run.lanes) {
  for (const side of ['you', 'partner']) add(run[side]?.kill, run.lanes.lane(side).spawn, side);
 } else add(run.kill, 0, 'shared');
 return { lanes, duration: Math.max(0, ...lanes.map(lane => lane.duration)) };
}

self.postMessage = result => {
 if (result.error) { send(result); return; }
 if (!run) { send({ id: result.id, error: '전투 타임라인을 읽지 못했어요.' }); return; }
 send({ ...result, battle: battleTimeline(run, result.correction.factor) });
};

self.onmessage = event => {
 run = null;
 return calculateMessage(event);
};
