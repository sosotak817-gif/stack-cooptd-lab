(function () {
  const $ = id => document.getElementById(id);
  const dialog = $('battle-replay');
  const format = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 2 });
  let worker, timeout, frame, data, time, last, playing, lanes;
  let tiles, watched, discovery, retryAt;

  async function discover() {
    const session = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!session.ok) return null;
    const { user, csrf } = await session.json();
    if (!user || !csrf) return null;
    const headers = { 'X-Account-Id': user.id, 'X-CSRF-Token': csrf };
    const request = action => fetch('/api/me/battle-discovery?action=' + action, { method: 'POST', headers });
    const started = await request('start');
    return started.ok ? request : null;
  }

  function countWatch(now) {
    if (last === null || document.hidden || !dialog.open) return;
    watched += Math.min(250, now - last);
    if (watched < 60000 || now < retryAt) return;
    retryAt = now + 5000;
    const attempt = discovery;
    attempt?.then(async request => {
      if (!request || attempt !== discovery || !dialog.open) return;
      const response = await request('finish');
      if (!response.ok || attempt !== discovery) return;
      const { earned } = await response.json();
      discovery = null;
      if (earned) {
        $('battle-status').textContent = '히든 업적 획득 · 전투 관전';
        window.top.dispatchEvent(new window.top.Event('stack-lab:achievement-earned'));
      }
    }).catch(() => {});
  }

  function stop() {
    playing = false;
    cancelAnimationFrame(frame);
    $('battle-toggle').textContent = '재생';
    for (const tile of tiles?.values() ?? []) tile.classList.remove('attacking');
  }

  function releaseWorker() {
    clearTimeout(timeout);
    worker?.terminate();
    worker = null;
  }

  function cumulative(segments, at) {
    return segments.reduce((sum, segment) =>
      sum + Math.max(0, Math.min(at, segment.to) - segment.from) * segment.rate, 0);
  }

  function render() {
    const damage = at => lanes.reduce((sum, lane) => sum + cumulative(lane.segments, at), 0);
    const prior = Math.max(0, time - 3);
    const total = damage(time);
    $('battle-time').textContent = time.toFixed(1) + ' / ' + data.duration.toFixed(1) + '초';
    $('battle-dps').textContent = format.format(time > prior ? (total - damage(prior)) / (time - prior) : 0);
    $('battle-damage').textContent = format.format(total);
    $('battle-seek').value = time;
    const attacking = new Set();
    for (const lane of lanes) {
      const span = lane.duration - lane.spawn;
      const progress = span > 0 ? Math.min(1, Math.max(0, (time - lane.spawn) / span)) : 0;
      const segment = lane.segments.find(entry => entry.from <= time && time < entry.to);
      const status = time < lane.spawn ? '등장 대기' : time >= lane.duration ?
        (lane.cleared ? '처치' : '전투 종료') : segment?.kind === 'shield' ? '보호막' : '전투 중';
      lane.label.textContent = lane.name + ' · ' + status + (segment?.phase != null ? ' · ' + (segment.phase + 1) + '페이즈' : '');
      lane.icon.style.setProperty('--progress', (progress * 94) + '%');
      lane.icon.classList.toggle('hit', segment?.rate > 0);
      lane.icon.hidden = time < lane.spawn;
      for (const attack of segment?.attacks ?? []) attacking.add(attack.home);
    }
    for (const [home, tile] of tiles) tile.classList.toggle('attacking', playing && attacking.has(home));
  }

  function tick(now) {
    if (!playing) return;
    countWatch(now);
    if (last !== null) time = Math.min(data.duration, time + (now - last) / 1000 * Number($('battle-speed').value));
    last = now;
    render();
    if (time >= data.duration) stop();
    else frame = requestAnimationFrame(tick);
  }

  function drawBoard(units, name, partner, stock) {
    const board = $('battle-board');
    board.replaceChildren();
    tiles = new Map();
    const damage = new Map();
    for (const lane of lanes) for (const segment of lane.segments) for (const { home, rate } of segment.attacks) {
      damage.set(home, (damage.get(home) ?? 0) + rate * (segment.to - segment.from));
    }
    $('battle-unit').textContent = '유닛을 선택하면 전투 전체의 피해 기여도와 실전 DPS 추정치를 확인할 수 있어요.';
    const positions = new Map(units.map(unit => [unit.row * 7 + unit.col, unit]));
    for (let index = partner ? 0 : 42; index < 77; index++) {
      const unit = positions.get(index);
      const tile = document.createElement(unit ? 'button' : 'span');
      board.append(tile);
      if (!unit) continue;
      tiles.set(index, tile);
      tile.type = 'button';
      const label = name(unit.slug) + ' · ' + (unit.row + 1) + '행 ' + (unit.col + 1) + '열';
      tile.setAttribute('aria-label', label);
      tile.setAttribute('aria-pressed', 'false');
      const image = document.createElement('img');
      image.src = '/assets/units/' + unit.slug + '.webp';
      image.alt = '';
      tile.append(image);
      tile.onclick = () => {
        for (const button of board.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button === tile));
        const dealt = damage.get(index) ?? 0;
        const omen = stock[index];
        $('battle-unit').textContent = label + ' · 실전 DPS 추정 ' + format.format(dealt / data.duration) +
          ' · 기여 피해 ' + format.format(dealt) +
          (omen ? ' · 심해 영혼 ' + format.format(omen.souls) + (omen.lord ? ' · 군주 해방' : '') : '');
      };
    }
  }

  function setup(result, input, name) {
    data = result.battle;
    if (!data?.duration) {
      $('battle-status').textContent = '재생 가능한 전투 구간이 없어요.';
      return;
    }
    time = 0;
    $('battle-seek').max = data.duration;
    $('battle-lanes').replaceChildren();
    lanes = data.lanes.map(lane => {
      const container = document.createElement('div');
      container.className = 'battle-lane';
      const label = document.createElement('strong');
      const track = document.createElement('div');
      track.className = 'battle-track';
      const icon = document.createElement('img');
      icon.className = 'battle-boss';
      icon.src = '/assets/bosses/giant.webp';
      icon.alt = '';
      track.append(icon);
      container.append(label, track);
      $('battle-lanes').append(container);
      return { ...lane, name: { you: '내 진영', partner: '파트너', shared: '보스' }[lane.side], label, icon };
    });
    drawBoard(result.units, name, input.partnerEnabled, result.stock);
    $('battle-status').textContent = '';
    $('battle-content').hidden = false;
    render();
  }

  function open(input, workerUrl, name) {
    stop();
    releaseWorker();
    watched = 0;
    retryAt = 0;
    discovery = null;
    $('battle-content').hidden = true;
    $('battle-status').textContent = '전투 타임라인 계산 중…';
    dialog.showModal();
    try {
      worker = new Worker(workerUrl);
      const fail = message => {
        releaseWorker();
        $('battle-status').textContent = message;
      };
      timeout = setTimeout(() => fail('계산 시간이 초과됐어요.'), 120000);
      worker.onerror = () => fail('계산 엔진을 열지 못했어요.');
      worker.onmessage = ({ data: result }) => {
        if (result.error) { fail(result.error); return; }
        releaseWorker();
        setup(result, input, name);
      };
      worker.postMessage({ ...input, kind: 'battle-replay', id: 1 });
    } catch {
      releaseWorker();
      $('battle-status').textContent = '계산 엔진을 열지 못했어요.';
    }
  }

  $('battle-toggle').onclick = () => {
    if (playing) { stop(); return; }
    if (time >= data.duration) time = 0;
    discovery ??= discover().catch(() => null);
    last = null;
    playing = true;
    $('battle-toggle').textContent = '일시정지';
    frame = requestAnimationFrame(tick);
  };
  $('battle-restart').onclick = () => { stop(); time = 0; render(); };
  $('battle-seek').oninput = event => { time = Number(event.target.value); render(); };
  document.addEventListener('visibilitychange', () => { last = null; });
  dialog.addEventListener('close', () => { stop(); releaseWorker(); discovery = null; });
  window.CoopBattleReplay = { open };
})();
