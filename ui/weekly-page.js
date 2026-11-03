(async function () {
  const $ = id => document.getElementById(id);
  const version = new URL(document.currentScript.src).search;
  const api = '/api/weekly-puzzle';
  const rules = CoopWeekly;
  const account = CoopPresets.newAccount(CoopEngine, CoopData);
  const valid = new Set(CoopGeometry.tilesOf('you').map(({ row, col }) => row * 7 + col));
  const format = value => new Intl.NumberFormat('ko-KR', { maximumSignificantDigits: 8 }).format(value);
  const labels = { hard: '어려움', hell: '지옥', abyss: '심연', deepsea: '심해' };
  const translation = await fetch('/ko.json' + version).then(r => r.json()).catch(() => ({}));
  const names = new Map(CoopData.DEMONS.map(d => [d.slug, translation[d.name] || d.name]));
  const initial = await fetch(api).then(r => r.json()).catch(() => ({}));
  const week = initial.currentWeek ?? rules.weekAt();
  const challenge = rules.puzzle(week, CoopPresets.presets);
  const history = [challenge.cells];
  let selected = null;
  let result = null;
  let baseline = null;
  let cancelCalculation = () => {};
  let submitting = false;
  let shownWeek = week;
  let rankingRequest = 0;
  const target = CoopTargets.finalBossOf(challenge.mode).id;
  const growth = structuredClone(account);
  for (const slug of new Set(challenge.cells.map(cell => cell.slug))) {
    growth.perDemon[slug] = { ...growth.perDemon[slug], level: CoopData.maxLevelFor(slug), lib: 20 };
  }
  $('challenge').textContent = rules.startDate(week) + ' 시작 · ' + challenge.name + ' · ' +
    labels[challenge.mode] + ' 최종 보스 · 매주 월요일 00:00 (한국 시간) 갱신';

  function render() {
    const cells = history.at(-1);
    $('moves').textContent = (history.length - 1) + ' / ' + rules.moveLimit + '수';
    $('undo').disabled = $('reset').disabled = history.length === 1;
    $('grid').replaceChildren();
    for (let index = 42; index < 77; index++) {
      if (!valid.has(index)) {
        $('grid').append(document.createElement('span'));
        continue;
      }
      const row = Math.floor(index / 7), col = index % 7;
      const cell = cells.find(c => c.row === row && c.col === col);
      const mark = challenge.marks.find(m => m.row === row && m.col === col);
      const button = document.createElement('button');
      button.type = 'button';
      button.disabled = history.length > rules.moveLimit || (!cell && selected === null);
      button.setAttribute('aria-pressed', String(selected === index));
      const name = cell ? names.get(cell.slug) || cell.slug : '빈 칸';
      button.setAttribute('aria-label', (row - 5) + '행 ' + (col + 1) + '열 ' + name);
      if (cell) {
        const image = document.createElement('img');
        image.src = '/assets/units/' + cell.slug + '.webp';
        image.alt = '';
        button.append(image);
      }
      const label = document.createElement('small');
      label.textContent = name;
      button.append(label);
      if (mark) {
        const effects = document.createElement('small');
        effects.textContent = [mark.boost && '치명타', mark.grace && '은총',
          mark.storms && '폭풍 ' + mark.storms].filter(Boolean).join(' · ');
        button.append(effects);
      }
      button.onclick = () => {
        if (selected === null || selected === index) {
          selected = selected === index ? null : index;
          render();
          $('grid').children[index - 42].focus();
          return;
        }
        const source = selected;
        history.push(cells.map(c => {
          const position = c.row * 7 + c.col;
          const next = position === source ? index : position === index ? source : position;
          return { ...c, row: Math.floor(next / 7), col: next % 7 };
        }));
        selected = null;
        evaluate();
      };
      $('grid').append(button);
    }
  }

  function evaluate() {
    cancelCalculation();
    result = null;
    $('submit').disabled = true;
    $('result').textContent = 'DPS 계산 중…';
    render();
    const active = new Worker('/board-worker.js' + version);
    const timeout = setTimeout(() => finish({ error: '계산 시간이 초과됐어요.' }), 30000);
    cancelCalculation = () => { clearTimeout(timeout); active.terminate(); };
    function finish(data) {
      cancelCalculation();
      if (data.error || !Number.isFinite(data.actual)) {
        $('result').textContent = data.error || 'DPS를 계산하지 못했어요.';
        return;
      }
      result = data.actual;
      if (history.length === 1) baseline = result;
      const delta = baseline === null ? '' : ' · 시작 배치 대비 ' +
        (result >= baseline ? '+' : '−') + format(Math.abs(result - baseline));
      $('result').textContent = format(result) + ' DPS' + delta;
      $('submit').disabled = submitting || result <= 0;
    }
    active.onmessage = ({ data }) => finish(data);
    active.onerror = () => finish({ error: '계산 엔진을 불러오지 못했어요.' });
    active.postMessage({ id: 1, mode: challenge.mode, target, cells: history.at(-1),
      marks: challenge.marks, you: growth, partner: account, partnerEnabled: false });
  }

  async function rankings() {
    const request = ++rankingRequest;
    $('ranking-week').textContent = rules.startDate(shownWeek) + ' 주간';
    $('next').disabled = shownWeek >= week;
    $('previous').disabled = shownWeek <= 0;
    $('rows').replaceChildren();
    $('ranking-status').textContent = '랭킹을 불러오는 중…';
    try {
      const response = await fetch(api + '?week=' + shownWeek);
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      if (request !== rankingRequest) return;
      for (const [i, row] of data.rows.entries()) {
        const tr = $('rows').insertRow();
        for (const value of [i + 1, row.nickname, format(row.score), row.moves]) {
          tr.insertCell().textContent = value;
        }
      }
      $('ranking-status').textContent = data.rows.length ? '' : '아직 등록된 기록이 없어요.';
    } catch (error) {
      if (request === rankingRequest) $('ranking-status').textContent = error.message || '랭킹 연결을 확인해 주세요.';
    }
  }

  $('register').onsubmit = async event => {
    event.preventDefault();
    if (submitting || result === null || result <= 0) return;
    const nickname = $('nickname').value.trim();
    if (!nickname) {
      $('submission-status').textContent = '닉네임을 입력해 주세요.';
      return;
    }
    $('submission-status').textContent = '기록 저장 중…';
    submitting = true;
    $('submit').disabled = true;
    try {
      const key = 'stack-weekly-puzzle-owner-v1';
      let token = localStorage.getItem(key);
      if (!token) {
        token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(key, token);
      }
      const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week, revision: COOP_SHARED_REVISION, token, nickname,
          score: result, moves: history.length - 1 }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      $('submission-status').textContent = data.improved ? '주간 기록을 등록했어요.' : '이전 최고 기록을 유지했어요.';
      shownWeek = week;
      await rankings();
    } catch (error) {
      $('submission-status').textContent = error.message || '기록을 저장하지 못했어요.';
    } finally {
      submitting = false;
      $('submit').disabled = result === null || result <= 0;
    }
  };
  $('undo').onclick = () => { history.pop(); selected = null; evaluate(); };
  $('reset').onclick = () => { history.length = 1; selected = null; evaluate(); };
  $('previous').onclick = () => { shownWeek--; rankings(); };
  $('next').onclick = () => { shownWeek++; rankings(); };
  evaluate();
  rankings();
})().catch(error => {
  document.getElementById('result').textContent = '퍼즐을 열지 못했어요. ' + error.message;
});
