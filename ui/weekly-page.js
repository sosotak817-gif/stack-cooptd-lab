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
  const day = initial.currentDay ?? rules.dayAt();
  const challenge = rules.puzzle(day, CoopPresets.presets);
  const history = [challenge.cells];
  const steps = [];
  let selected = null;
  let result = null;
  let baseline = null;
  let cancelCalculation = () => {};
  let submitting = false;
  const target = CoopTargets.finalBossOf(challenge.mode).id;
  const growth = structuredClone(account);
  for (const slug of new Set(challenge.cells.map(cell => cell.slug))) {
    growth.perDemon[slug] = { ...growth.perDemon[slug], level: CoopData.maxLevelFor(slug), lib: 20 };
  }
  $('challenge').textContent = '오늘의 문제 · ' + challenge.name + ' · ' +
    labels[challenge.mode] + ' 최종 보스 · 매일 00:00 (한국 시간) 갱신';

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
      button.disabled = baseline === null || history.length > rules.moveLimit || (!cell && selected === null);
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
        steps.push([selected, index]);
        history.push(rules.move(cells, selected, index));
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
      if (history.length === 1 && baseline === null) { baseline = result; render(); }
      const delta = baseline === null ? '' : ' · 시작 배치 대비 ' +
        (result >= baseline ? '+' : '−') + format(Math.abs(result - baseline));
      $('result').textContent = format(result) + ' DPS' + delta;
      $('submit').disabled = submitting || !(baseline > 0);
    }
    active.onmessage = ({ data }) => finish(data);
    active.onerror = () => finish({ error: '계산 엔진을 불러오지 못했어요.' });
    active.postMessage({ id: 1, mode: challenge.mode, target, cells: history.at(-1),
      marks: challenge.marks, you: growth, partner: account, partnerEnabled: false });
  }

  let puzzleAccount = null;
  async function readPuzzleAccount() {
    const response = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!response.ok) throw Error('계정 상태를 확인하지 못했어요.');
    const state = await response.json();
    puzzleAccount = state.user && state.csrf ? { ...state.user, csrf: state.csrf } : null;
    $('nickname').disabled = !!puzzleAccount;
    $('nickname').value = puzzleAccount?.nickname || '';
    $('nickname').required = !puzzleAccount;
    $('puzzle-account-status').textContent = puzzleAccount
      ? puzzleAccount.nickname + ' 계정으로 제출합니다.'
      : '브라우저에서 입력한 닉네임으로 제출합니다.';
  }
  readPuzzleAccount().catch(() => {});
  $('register').onsubmit = async event => {
    event.preventDefault();
    if (submitting || result === null || !(baseline > 0)) return;
    const account = puzzleAccount;
    const nickname = account?.nickname || $('nickname').value.trim();
    if (!nickname) {
      $('submission-status').textContent = '닉네임을 입력해 주세요.';
      return;
    }
    $('submission-status').textContent = '기록 저장 중…';
    submitting = true;
    $('submit').disabled = true;
    const attempt = { day, mode: challenge.mode, cells: history.at(-1), marks: challenge.marks,
      score: Math.round((result / baseline - 1) * 1e8) / 1e6 };
    try {
      const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(account ? { 'X-CSRF-Token': account.csrf } : {}) },
        body: JSON.stringify({ day, revision: COOP_SHARED_REVISION, nickname,
          score: attempt.score, moves: steps.length, steps }) });
      const data = await response.json();
      if (!response.ok) {
        if (account && [401, 403].includes(response.status)) await readPuzzleAccount().catch(() => {});
        throw Error(data.error);
      }
      $('submission-status').textContent = data.improved ? '주간 기록을 등록했어요.' : '이전 최고 기록을 유지했어요.';
      try {
        const key = rules.personalKey(day) + (account ? ':account:' + account.id : '');
        const previous = JSON.parse(localStorage.getItem(key) || 'null');
        if (!previous || attempt.score >= previous.score) localStorage.setItem(key, JSON.stringify(attempt));
      } catch {}
    } catch (error) {
      $('submission-status').textContent = error.message || '기록을 저장하지 못했어요.';
    } finally {
      submitting = false;
      $('submit').disabled = result === null || !(baseline > 0);
    }
  };
  $('undo').onclick = () => { history.pop(); steps.pop(); selected = null; evaluate(); };
  $('reset').onclick = () => { history.length = 1; steps.length = 0; selected = null; evaluate(); };
  evaluate();
})().catch(error => {
  document.getElementById('result').textContent = '퍼즐을 열지 못했어요. ' + error.message;
});
