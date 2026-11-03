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
    renderBoard($('replay-board'), cells, replay.marks, changed);
  }

  function renderBoard(board, cells, marks, changed) {
    board.replaceChildren();
    for (let index = 42; index < 77; index++) {
      const tile = document.createElement('div');
      board.append(tile);
      if (!valid.has(index)) continue;
      tile.className = changed.includes(index) ? 'tile changed' : 'tile';
      const cell = cells.find(c => c.row * 7 + c.col === index);
      const mark = marks.find(m => m.row * 7 + m.col === index);
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
    $('comparison').hidden = true;
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

  function compare(row) {
    $('replay').hidden = true;
    $('comparison').hidden = false;
    let own;
    try { own = JSON.parse(localStorage.getItem(rules.personalKey(row.replay.day)) || 'null'); } catch {}
    const available = own?.mode === row.replay.mode && Array.isArray(own?.cells) && Array.isArray(own?.marks);
    $('comparison-boards').hidden = !available;
    if (available) {
      const other = row.replay.steps.reduce((cells, [from, to]) => rules.move(cells, from, to), row.replay.cells);
      const positions = cells => new Map(cells.map(cell => [cell.row * 7 + cell.col, cell.slug + ':' + !!cell.lib]));
      const mine = positions(own.cells), theirs = positions(other);
      const changed = [...valid].filter(index => mine.get(index) !== theirs.get(index));
      $('other-title').textContent = row.nickname + ' 님의 배치';
      $('comparison-summary').textContent = '내 기록 ' + percent.format(own.score / 100) +
        ' · 상대 기록 ' + percent.format(row.score / 100) + ' · 다른 칸 ' + changed.length + '개';
      renderBoard($('my-board'), own.cells, own.marks, changed);
      renderBoard($('other-board'), other, row.replay.marks, changed);
    } else {
      $('comparison-summary').textContent = '이 브라우저에 같은 날의 제출 기록이 없어요.';
    }
    $('comparison-title').focus();
    $('comparison').scrollIntoView({ block: 'start' });
  }

  async function rankings(week) {
    const id = ++requestId;
    $('previous').disabled = $('next').disabled = true;
    $('rows').replaceChildren();
    $('replay').hidden = $('comparison').hidden = true;
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
        for (const [index, value] of [i + 1, row.nickname, percent.format(row.score / 100), row.moves].entries()) {
          const cell = tr.insertCell();
          cell.textContent = value;
          if (index === 1) {
            const name = document.createElement('span');
            name.className = 'lab-ranked-name';
            name.textContent = value;
            if (row.badgeCode) name.append(window.StackLabBadge.icon(row.badgeCode, row.badgeTitle));
            cell.replaceChildren(name);
            cell.append(row.account ? ' · 계정' : ' · 익명');
          }
        }
        const action = tr.insertCell();
        if (row.replay) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = '배치 보기';
          button.setAttribute('aria-label', row.nickname + ' 님 배치 보기');
          button.onclick = () => showReplay(row);
          const compareButton = document.createElement('button');
          compareButton.type = 'button';
          compareButton.textContent = '내 배치와 비교';
          compareButton.onclick = () => compare(row);
          action.append(button, ' ', compareButton);
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
