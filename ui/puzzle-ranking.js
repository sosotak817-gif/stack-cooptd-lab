(async function () {
  const $ = id => document.getElementById(id);
  const rules = CoopWeekly;
  const percent = new Intl.NumberFormat('ko-KR', { style: 'percent', maximumFractionDigits: 6, signDisplay: 'exceptZero' });
  const dictionary = await fetch('/ko.json').then(r => r.json()).catch(() => ({}));
  const names = new Map(CoopData.DEMONS.map(d => [d.slug, dictionary[d.name] || d.name]));
  const valid = new Set(CoopGeometry.tilesOf('you').map(({ row, col }) => row * 7 + col));
  let currentWeek = rules.weekAt(), shownWeek = currentWeek;
  let requestId = 0;
  let replay, step;

  function renderReplay() {
    let cells = replay.cells;
    for (const [from, to] of replay.steps.slice(0, step)) cells = rules.move(cells, from, to);
    const changed = replay.steps[step - 1] || [];
    $('step-number').textContent = step === 0 ? '시작 배치' : step + ' / ' + replay.steps.length + '수';
    $('back-step').disabled = step === 0;
    $('forward-step').disabled = step === replay.steps.length;
    $('replay-board').replaceChildren();
    for (let index = 42; index < 77; index++) {
      const tile = document.createElement('div');
      $('replay-board').append(tile);
      if (!valid.has(index)) continue;
      tile.className = changed.includes(index) ? 'tile changed' : 'tile';
      const cell = cells.find(c => c.row * 7 + c.col === index);
      const mark = replay.marks.find(m => m.row * 7 + m.col === index);
      if (cell) {
        const image = document.createElement('img');
        image.src = '/assets/units/' + cell.slug + '.webp';
        image.alt = '';
        tile.append(image);
      }
      const label = document.createElement('small');
      label.textContent = cell ? names.get(cell.slug) || cell.slug : '빈 칸';
      tile.append(label);
      if (mark) {
        const effects = document.createElement('small');
        effects.textContent = [mark.boost && '치명타', mark.grace && '은총',
          mark.storms && '폭풍 ' + mark.storms].filter(Boolean).join(' · ');
        tile.append(effects);
      }
    }
  }

  function showReplay(row) {
    replay = row.replay;
    step = replay.steps.length;
    $('replay-title').textContent = row.nickname + ' 님의 배치';
    const week = Math.floor(replay.day / 7);
    const date = new Date(Date.parse(rules.startDate(week)) + (replay.day % 7) * 86400000);
    const mode = { hard: '어려움', hell: '지옥', abyss: '심연', deepsea: '심해' }[replay.mode];
    $('replay-summary').textContent = [date.toISOString().slice(0, 10), replay.name, mode, percent.format(row.score / 100)].join(' · ');
    $('replay').hidden = false;
    renderReplay();
    $('replay-title').focus();
    $('replay').scrollIntoView({ block: 'start' });
  }

  async function rankings(week) {
    const id = ++requestId;
    $('previous').disabled = $('next').disabled = true;
    $('rows').replaceChildren();
    $('replay').hidden = true;
    $('ranking-status').textContent = '랭킹을 불러오는 중…';
    try {
      const response = await fetch('/api/weekly-puzzle' + (week === undefined ? '' : '?week=' + week));
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      if (id !== requestId) return;
      currentWeek = data.currentWeek;
      shownWeek = data.week;
      for (const [i, row] of data.rows.entries()) {
        const tr = $('rows').insertRow();
        for (const value of [i + 1, row.nickname, percent.format(row.score / 100), row.moves]) {
          tr.insertCell().textContent = value;
        }
        const action = tr.insertCell();
        if (row.replay) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = '배치 보기';
          button.setAttribute('aria-label', row.nickname + ' 님 배치 보기');
          button.onclick = () => showReplay(row);
          action.append(button);
        } else {
          action.textContent = '배치 기록 없음';
        }
      }
      $('ranking-status').textContent = data.rows.length ? '' : '아직 등록된 기록이 없어요.';
    } catch (error) {
      if (id === requestId) $('ranking-status').textContent = error.message || '랭킹 연결을 확인해 주세요.';
    } finally {
      if (id === requestId) {
        $('ranking-week').textContent = rules.startDate(shownWeek) + ' 주간 · TOP 50';
        $('next').disabled = shownWeek >= currentWeek;
        $('previous').disabled = shownWeek <= 0;
      }
    }
  }

  $('previous').onclick = () => rankings(shownWeek - 1);
  $('next').onclick = () => rankings(shownWeek + 1);
  $('back-step').onclick = () => { step--; renderReplay(); };
  $('forward-step').onclick = () => { step++; renderReplay(); };
  rankings();
})();
