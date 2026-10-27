const KAISER = Object.freeze({
  demon: {
    slug: 'kaiser', name: 'Kaiser', img: 'kaiser', att: 10000, lvlatt: 1600,
    as: 0, lvlas: 0, range: 2, bd: 5000, lvlbd: 0,
    libAtkSource: 'verified', rarity: 'Supreme Demon God'
  },
  rawUnit: {
    id: 'Unit_God_Kaiser', grade: 5, tower: 'God', canMergeGod: false,
    atk: 10000, atkEnh: 0.16, spd: 0, spdEnh: 0, fixSpd: true,
    boss: 5000, bossEnh: 0, crit: 10, critDmg: 150, targets: 1,
    ap: [1.2, 15, 500, 40, 5, 5, 5, 100],
    apEnh: [0, 0, 100, 0, 1, 1, 0.5, 10]
  },
  liberation: {
    skills: [
      {
        name: 'Authority', unlock: 1,
        desc: 'Fireball Count +1, Grace Tile Count +1.',
        upgraded: { at: 11, desc: 'Fireball Count +2, Grace Tile Count +3.' }
      },
      {
        name: 'Descent', unlock: 6,
        desc: 'Kaiser descends and casts Basic Attacks. Range and ATK SPD are fixed at 2, and all enemies within range are attacked. Basic Attack DMG increases by the amount equal to 50% of CRIT Rate. When only one enemy is within range, this effect is multiplied by 30.',
        upgraded: { at: 16, desc: 'Kaiser descends and casts Basic Attacks. Range and ATK SPD are fixed at 2, and all enemies within range are attacked. Basic Attack DMG increases by the amount equal to CRIT Rate. When only one enemy is within range, this effect is multiplied by 100.' }
      }
    ],
    atkInc: 100
  },
  relic: {
    id: 1043, grade: 3, owner: 'kaiser', ownerName: 'Kaiser', name: 'Ember of Eternity',
    desc: 'Fireball MOV SPD +{0}%', params: [10], enhance: [4],
    breakDesc: 'Fireball Final DMG +{0}%', breakParams: [5], breakEnhance: [0.5]
  },
  exclusiveRelic: {
    slug: 'kaiser', name: 'Ember of Eternity',
    desc: 'Fireball movement speed +{0}%.', terms: [[10, 4]], modelled: true,
    breakthrough: { name: 'Ember of Eternity', desc: 'Fireball final damage +{0}%.', terms: [[5, 0.5]] }
  }
});

// Ported from the current public Coop Tools Kaiser model. It uses the archived
// engine's existing damage, attack-speed, liberation, and breakdown helpers.
function kaiserModel(e) {
  const elapsed = Math.max(1, Math.floor(e.p.wave) - Math.max(1, Math.floor(e.p.installWave)) + 1);
  const gracePerWave = Math.trunc(eH('kaiser', 4, e.L));
  const grace = elapsed * gracePerWave;
  e.atkPct += grace;
  ap(e, `Grace ×${elapsed}`, 'atkPct', grace);
  e.critMult += grace / 100;
  ap(e, `Grace ×${elapsed}`, 'critDmg', grace);
  t$(e, { text: `Grace: +${gracePerWave}% ATK and CRIT DMG for every wave since summon, counting the summon wave; ×${elapsed} = +${grace}% to both. Grace tiles carry the same bonuses.`, verified: true });

  const domination = Math.trunc(eH('kaiser', 6, e.L));
  if (Number.isFinite(e.p.domination) && e.p.domination > 0) {
    e.baseAtk = e.whiteAtk(e.p.domination);
    ap(e, "Kaiser's Domination", 'baseAtk', e.p.domination);
  } else {
    e.baseAtk = e.whiteAtk(domination);
    ap(e, 'Domination', 'baseAtk', domination);
    t$(e, { text: `Domination: +${domination}% Base ATK to monsters on the field. It is added before Liberation and gem-grade base ATK multipliers.`, verified: true });
  }

  const lib = e.lib;
  const fireballs = 1 + (lib >= 11 ? 2 : lib >= 1 ? 1 : 0);
  const fireballPct = Math.trunc(eH('kaiser', 2, e.L));
  const relicLevel = Math.max(0, Math.round(e.p.relicLevel || 0));
  const relicSpeed = relicLevel > 0 ? eO(10, 4, relicLevel) : 0;
  const startSpeed = eH('kaiser', 0, e.L) * (1 + relicSpeed / 100);
  const acceleration = Math.max(0, eH('kaiser', 1, e.L)) / 100;
  let lap;
  if (e.p.mode === 'wall') {
    const fixedSpeed = startSpeed * Math.pow(1 + acceleration / 100, 5);
    lap = Math.ceil(62 / fixedSpeed * 30) / 30;
  } else {
    let distance = 0, speed = startSpeed, frames = 0;
    while (distance < 21.3 && frames < 10000) {
      distance += speed / 30;
      speed *= 1 + acceleration / 29;
      frames++;
    }
    lap = Math.max(1, frames) / 30;
  }
  const fireballRate = fireballs / lap;
  const count = e.targets;
  const relicFinal = af(e);
  e.postDefPct += relicFinal;
  const fireballDamage = ar(e, fireballPct / 100, { noBasicPct: true });
  e.postDefPct -= relicFinal;
  const comps = [{
    label: `Blaze: ${fireballs} fireball${fireballs === 1 ? '' : 's'} × ${fireballPct}% ATK, one hit per lap (${lap.toFixed(2)}s) × ${count} enemies`,
    dps: fireballDamage.total * fireballRate * count,
    kind: 'skill', events: fireballRate * count, stunProof: true
  }];
  t$(e, { text: `Blaze: ${fireballs} fireball${fireballs === 1 ? '' : 's'} loop the lane and hit each enemy once per ${lap.toFixed(2)}s lap. Each hit is ${fireballPct}% ATK with its own CRIT roll and Boss DMG.`, verified: true },
    { text: 'Fireballs are skill damage; Basic Attack DMG bonuses do not apply. A hit slows its target by 40%.', verified: true },
    { text: `Authority unlocks at Lib 1: ${fireballs} fireball${fireballs === 1 ? '' : 's'} and ${1 + (lib >= 11 ? 3 : lib >= 1 ? 1 : 0)} Grace tiles. The Lib 11 upgrade raises these to +2 fireballs and +3 tiles.`, verified: true });
  if (lib < 6) {
    tC(e, 1);
    return { comps, speed: 0, raw: 0, enemies: count, hits: 1 };
  }

  const targets = aE(e, 'basic');
  const { speed, raw } = t8(e, 2);
  const solo = targets <= 1;
  const baseBonus = lib >= 16 ? 100 : 50;
  const soloMultiplier = lib >= 16 ? 100 : 30;
  const extraBasicPct = Math.max(0, baseBonus * e.rawCritRate * (solo ? soloMultiplier : 1));
  e.targetPct += extraBasicPct;
  comps.push(...am(e, speed, targets, 'Basic attack').map(c => ({ ...c, reach: 'basic' })));
  t$(e, { text: `Descent (Lib 6): fixed range and ATK SPD 2. Basic Attack DMG gains ${baseBonus}% of raw CRIT Rate${solo ? ` × ${soloMultiplier} with one enemy in range` : ''}: +${Math.round(extraBasicPct)}%. The Lib 16 upgrade changes these to 100% and ×100.`, verified: true },
    { text: 'Fireballs keep running after Descent; its Basic Attack DMG bonus does not affect them.', verified: true });
  return { comps, speed, raw, enemies: targets, hits: 1 };
}

function applyKaiserData(data, demons, liberation, board, relics) {
  const demon = { ...KAISER.demon, libAtk: level => {
    const lib = Math.max(0, Math.min(20, Math.round(level)));
    return 500 + 100 * Math.min(lib, 10) + 150 * Math.max(0, lib - 10);
  } };
  data.UNITS.kaiser = { ...KAISER.rawUnit };
  data.LIB_ATK.kaiser = { base: 500, t1: 100, t2: 150 };
  data.RELICS.push({ ...KAISER.relic });
  demons.push(demon);
  const ds = require('./inspect.cjs').load(34621);
  ds.DEMON_BY_SLUG.set('kaiser', demon);
  ds.SUPREME_SLUGS.add('kaiser');
  liberation.kaiser = structuredClone(KAISER.liberation);
  board.UNITS.push({ id: 'kaiser', name: 'Kaiser', rarity: 'supreme' });
  board.UNIT_BY_ID.set('kaiser', board.UNITS.at(-1));
  relics.EXCLUSIVE_RELIC_BY_SLUG.set('kaiser', KAISER.exclusiveRelic);
  return demon;
}

module.exports = { KAISER, kaiserModel, applyKaiserData };
