(() => {
  const actions = document.querySelector('.top-actions');
  if (!actions) return;
  const open = document.createElement('button');
  open.className = 'account-chip';
  open.textContent = '계정 세팅';
  actions.prepend(open);

  const dialog = document.createElement('dialog');
  dialog.className = 'account-dialog';
  dialog.setAttribute('aria-labelledby', 'account-board-title');
  dialog.innerHTML = `
    <div class="account-heading">
      <h2 id="account-board-title">계정 배치 세팅</h2>
      <form method="dialog"><button>닫기</button></form>
    </div>
    <p>계정에 배치, 성장, 보석, 전투 세팅을 한 묶음으로 보관합니다.</p>
    <a href="/account/">내 계정 · 로그인</a>
    <p role="status"></p>
    <div data-controls hidden>
      <button data-save>이 브라우저 세팅을 계정에 저장</button>
      <button data-load>계정 세팅을 이 브라우저에 적용</button>
      <button data-restore hidden>계정의 직전 버전 복원</button>
    </div>
    <details data-settings hidden>
      <summary>성장·보석·전투 설정</summary>
      <p>배치, 맵, 보스를 유지하면서 설정만 따로 저장하거나 적용합니다.</p>
      <button data-settings-save>현재 설정을 계정에 저장</button>
      <button data-settings-load>계정 설정을 이 브라우저에 적용</button>
    </details>
    <section data-merge hidden>
      <h3>이 브라우저와 계정의 배치 비교</h3>
      <p data-merge-summary></p>
      <button data-merge-keep>브라우저 배치도 별도 덱으로 보관</button>
      <button data-merge-account>계정 배치를 이 브라우저에 적용</button>
      <button data-merge-local>현재 브라우저 배치 계속 사용</button>
    </section>
    <details data-decks hidden>
      <summary>계정에 저장한 덱</summary>
      <label>덱 이름 <input data-deck-name maxlength="60"></label>
      <button data-deck-new>현재 배치를 새 덱으로 저장</button>
      <label>저장한 덱 <select data-deck-list></select></label>
      <button data-deck-load>선택한 덱 불러오기</button>
      <button data-deck-update>선택한 덱을 현재 배치로 교체</button>
      <button data-deck-delete>선택한 덱 삭제</button>
    </details>`;
  document.body.append(dialog);
  const status = dialog.querySelector('[role=status]');
  const controls = dialog.querySelector('[data-controls]');
  const save = dialog.querySelector('[data-save]');
  const load = dialog.querySelector('[data-load]');
  const restore = dialog.querySelector('[data-restore]');
  const deckPanel = dialog.querySelector('[data-decks]');
  const deckName = dialog.querySelector('[data-deck-name]');
  const deckList = dialog.querySelector('[data-deck-list]');
  const deckActions = ['load', 'update', 'delete'];
  const settingsPanel = dialog.querySelector('[data-settings]');
  const settingsLoad = dialog.querySelector('[data-settings-load]');
  let accountSettings = null;
  const mergePanel = dialog.querySelector('[data-merge]');
  const mergeAccount = dialog.querySelector('[data-merge-account]');
  const mergeSummary = dialog.querySelector('[data-merge-summary]');
  const mergeResolved = new Set();
  const mergeKey = 'stack-lab-account-board-choice-v1:';
  let comparedLocal = null;
  let decks = [];
  let backup = null;
  let session = null;
  let remote = null;
  let busy = false;

  async function api(path, options = {}) {
    const response = await fetch(path, { cache: 'no-store', signal: AbortSignal.timeout(15000), ...options });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.error || '계정 세팅 연결을 확인해 주세요.');
      error.status = response.status;
      throw error;
    }
    return result;
  }

  async function refresh() {
    controls.hidden = true;
    deckPanel.hidden = true;
    mergePanel.hidden = true;
    settingsPanel.hidden = true;
    session = await api('/api/auth/me');
    remote = null;
    if (!session.user) return '계정에 로그인해 주세요.';
    remote = await api('/api/account/board', { headers: { 'X-Account-Id': session.user.id } });
    backup = null;
    if (remote.board) {
      const result = await api('/api/account/board?backup=1', { headers: { 'X-Account-Id': session.user.id } });
      if (result.backup?.currentRevision === remote.revision) backup = result.backup;
    }
    restore.hidden = !backup;
    controls.hidden = false;
    load.hidden = !remote.board;
    await refreshDecks();
    await compareInitial();
    await refreshSettings();
    return session.user.nickname + (remote.board
      ? ' · 저장된 배치 ' + remote.board.cells.length + '개 · 버전 ' + remote.revision
      : ' · 저장된 계정 세팅이 없습니다.');
  }

  async function run(task) {
    if (busy) return;
    busy = true;
    save.disabled = load.disabled = restore.disabled = true;
    status.textContent = '계정 세팅을 확인하고 있습니다.';
    try {
      status.textContent = await task();
    } catch (error) {
      if ([401, 403, 409].includes(error.status)) {
        controls.hidden = true;
        deckPanel.hidden = true;
        mergePanel.hidden = true;
        settingsPanel.hidden = true;
        status.textContent = error.message + ' 창을 다시 열어 최신 상태를 확인해 주세요.';
      } else {
        status.textContent = error.message;
      }
    } finally {
      save.disabled = load.disabled = restore.disabled = false;
      busy = false;
    }
  }

  open.addEventListener('click', () => {
    dialog.showModal();
    run(refresh);
  });

  save.addEventListener('click', () => run(async () => {
    if (!session?.user || !remote) return '계정 상태를 다시 확인해 주세요.';
    if (remote.board && !confirm(session.user.nickname + ' 계정의 기존 배치 세팅을 교체할까요?')) {
      return '계정 저장을 취소했습니다.';
    }
    const adapter = window.StackLabAccount;
    await adapter.ready;
    const saved = await api('/api/account/board', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': session.csrf,
        'X-Account-Id': session.user.id
      },
      body: JSON.stringify({ board: adapter.snapshot(), revision: remote.revision })
    });
    load.hidden = true;
    controls.hidden = true;
    return session.user.nickname + ' 계정에 저장했습니다. 버전 ' + saved.revision + ' · 다시 비교하려면 창을 열어 주세요.';
  }));

  load.addEventListener('click', () => run(async () => {
    if (!session?.user || !remote?.board) return '저장된 계정 세팅을 확인해 주세요.';
    const adapter = window.StackLabAccount;
    await adapter.ready;
    const before = JSON.stringify(adapter.snapshot());
    if (!confirm(session.user.nickname + ' 계정 세팅을 적용할까요? 현재 브라우저 세팅을 따로 보관하려면 먼저 JSON으로 내보내세요.')) {
      return '계정 세팅 적용을 취소했습니다.';
    }
    const latest = await api('/api/account/board', { headers: { 'X-Account-Id': session.user.id } });
    if (latest.revision !== remote.revision || JSON.stringify(adapter.snapshot()) !== before) {
      controls.hidden = true;
      return '비교한 세팅이 변경되었습니다. 창을 다시 열어 확인해 주세요.';
    }
    adapter.load(latest.board);
    return session.user.nickname + ' 계정의 세팅을 적용했습니다.';
  }));

  restore.addEventListener('click', () => run(async () => {
    if (!session?.user || !backup) return '복원할 버전을 다시 확인해 주세요.';
    if (!confirm(session.user.nickname + ' 계정의 세팅을 버전 ' + backup.revision + '으로 복원할까요?')) {
      return '계정 세팅 복원을 취소했습니다.';
    }
    const restored = await api('/api/account/board?backup=1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': session.csrf,
        'X-Account-Id': session.user.id
      },
      body: JSON.stringify({ revision: backup.currentRevision, backupRevision: backup.revision })
    });
    await refresh();
    return '계정에 직전 세팅을 복원했습니다. 현재 버전 ' + restored.revision + ' · 브라우저에 적용하려면 불러오기를 선택하세요.';
  }));

  async function refreshSettings() {
    const headers = { 'X-Account-Id': session.user.id };
    accountSettings = await api('/api/me/settings', { headers });
    settingsLoad.hidden = !accountSettings.settings;
    settingsPanel.hidden = false;
  }

  for (const action of ['save', 'load']) {
    dialog.querySelector('[data-settings-' + action + ']').addEventListener('click', () => run(async () => {
      if (!session?.user || !accountSettings || settingsPanel.hidden) return '계정 상태를 다시 확인해 주세요.';
      const adapter = window.StackLabAccount;
      await adapter.ready;
      const current = adapter.snapshot();
      const headers = { 'X-Account-Id': session.user.id };
      if (action === 'save') {
        if (accountSettings.settings && !confirm('계정에 저장된 설정을 교체할까요?')) return '설정 저장을 취소했습니다.';
        const { you, partner, inventory } = current;
        await api('/api/me/settings', {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf },
          body: JSON.stringify({ settings: { version: 1, you, partner, inventory }, revision: accountSettings.revision })
        });
        await refreshSettings();
        return '성장·보석·전투 설정을 계정에 저장했습니다.';
      }
      if (!confirm('계정에 저장된 성장·보석·전투 설정을 적용할까요?')) return '설정 적용을 취소했습니다.';
      const latest = await api('/api/me/settings', { headers });
      if (!latest.settings || latest.revision !== accountSettings.revision ||
          JSON.stringify(current) !== JSON.stringify(adapter.snapshot())) {
        await refreshSettings();
        return '비교한 설정이 변경되었습니다. 다시 확인해 주세요.';
      }
      const { you, partner, inventory } = latest.settings;
      adapter.load({ ...current, you, partner, inventory });
      return '배치는 유지하고 계정 설정을 적용했습니다.';
    }));
  }

  async function compareInitial() {
    const id = session.user.id;
    try {
      if (localStorage.getItem(mergeKey + id)) return;
    } catch {}
    if (mergeResolved.has(id)) return;
    const adapter = window.StackLabAccount;
    await adapter.ready;
    const local = adapter.snapshot();
    comparedLocal = JSON.stringify(local);
    if (remote.board && comparedLocal === JSON.stringify(remote.board)) return;
    mergeSummary.textContent = '이 브라우저 배치 ' + local.cells.length + '개 · ' +
      (remote.board ? '계정 배치 ' + remote.board.cells.length + '개' : '계정의 현재 배치 없음');
    mergeAccount.hidden = !remote.board;
    mergePanel.hidden = false;
  }

  function finishMerge(id) {
    mergeResolved.add(id);
    try {
      localStorage.setItem(mergeKey + id, '1');
    } catch {}
    mergePanel.hidden = true;
  }

  for (const choice of ['keep', 'account', 'local']) {
    dialog.querySelector('[data-merge-' + choice + ']').addEventListener('click', () => run(async () => {
      if (mergePanel.hidden || !session?.user) return '계정 세팅을 다시 확인해 주세요.';
      const id = session.user.id;
      const adapter = window.StackLabAccount;
      const local = adapter.snapshot();
      if (JSON.stringify(local) !== comparedLocal) {
        await compareInitial();
        return '브라우저 배치가 변경되었습니다. 다시 비교해 주세요.';
      }
      if (choice === 'keep') {
        const { deck } = await api('/api/me/decks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf },
          body: JSON.stringify({ accountId: id, name: '이 브라우저에서 가져온 덱', board: local })
        });
        finishMerge(id);
        await refreshDecks(deck.id);
        return '브라우저 배치를 계정에 별도 덱으로 저장했습니다.';
      }
      if (choice === 'account') {
        const latest = await api('/api/account/board', { headers: { 'X-Account-Id': id } });
        if (!latest.board || latest.revision !== remote.revision || JSON.stringify(adapter.snapshot()) !== comparedLocal) {
          await refresh();
          return '비교한 배치가 변경되었습니다. 다시 선택해 주세요.';
        }
        adapter.load(latest.board);
      }
      finishMerge(id);
      return choice === 'account' ? '계정 배치를 이 브라우저에 적용했습니다.' : '현재 브라우저 배치를 계속 사용합니다.';
    }));
  }

  async function refreshDecks(preferredId = deckList.value) {
    const { decks: latest } = await api('/api/me/decks');
    decks = latest;
    deckList.replaceChildren(...decks.map(deck => new Option(deck.name, deck.id)));
    if (decks.some(deck => deck.id === preferredId)) deckList.value = preferredId;
    deckPanel.hidden = false;
    for (const action of deckActions) dialog.querySelector('[data-deck-' + action + ']').disabled = !decks.length;
  }

  for (const action of ['new', ...deckActions]) {
    dialog.querySelector('[data-deck-' + action + ']').addEventListener('click', () => run(async () => {
      if (!session?.user || deckPanel.hidden) return '계정에 로그인해 주세요.';
      const selected = decks.find(deck => deck.id === deckList.value);
      if (action !== 'new' && !selected) return '저장한 덱을 선택해 주세요.';
      const id = selected?.id;
      const path = '/api/me/decks' + (action === 'new' ? '' : '/' + encodeURIComponent(id));
      const adapter = window.StackLabAccount;
      await adapter.ready;
      if (action === 'load') {
        const before = JSON.stringify(adapter.snapshot());
        if (!confirm(selected.name + ' 덱을 이 브라우저에 적용할까요?')) return '덱 적용을 취소했습니다.';
        const { deck } = await api(path);
        if (deck.revision !== selected.revision || JSON.stringify(adapter.snapshot()) !== before) {
          await refreshDecks();
          return '비교한 덱이 변경되었습니다. 다시 선택해 주세요.';
        }
        adapter.load(deck.board);
        return deck.name + ' 덱을 적용했습니다.';
      }
      if (action !== 'new' && !confirm(selected.name + (action === 'delete' ? ' 덱을 삭제할까요?' : ' 덱을 현재 배치로 교체할까요?'))) {
        return '작업을 취소했습니다.';
      }
      const payload = { accountId: session.user.id };
      if (action !== 'new') payload.revision = selected.revision;
      if (action !== 'delete') {
        payload.name = deckName.value.trim() || (action === 'update' ? selected.name : '');
        if (!payload.name) return '덱 이름을 입력해 주세요.';
        payload.board = adapter.snapshot();
      }
      const result = await api(path, {
        method: { new: 'POST', update: 'PUT', delete: 'DELETE' }[action],
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf },
        body: JSON.stringify(payload)
      });
      deckName.value = '';
      await refreshDecks(result.deck?.id);
      return action === 'delete' ? '덱을 삭제했습니다.' : '계정에 덱을 저장했습니다.';
    }));
  }
})();
