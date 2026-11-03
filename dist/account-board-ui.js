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
    </div>`;
  document.body.append(dialog);
  const status = dialog.querySelector('[role=status]');
  const controls = dialog.querySelector('[data-controls]');
  const save = dialog.querySelector('[data-save]');
  const load = dialog.querySelector('[data-load]');
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
    session = await api('/api/auth/me');
    remote = null;
    if (!session.user) return '계정에 로그인해 주세요.';
    remote = await api('/api/account/board', { headers: { 'X-Account-Id': session.user.id } });
    controls.hidden = false;
    load.hidden = !remote.board;
    return session.user.nickname + (remote.board
      ? ' · 저장된 배치 ' + remote.board.cells.length + '개 · 버전 ' + remote.revision
      : ' · 저장된 계정 세팅이 없습니다.');
  }

  async function run(task) {
    if (busy) return;
    busy = true;
    save.disabled = load.disabled = true;
    status.textContent = '계정 세팅을 확인하고 있습니다.';
    try {
      status.textContent = await task();
    } catch (error) {
      if ([401, 403, 409].includes(error.status)) {
        controls.hidden = true;
        status.textContent = error.message + ' 창을 다시 열어 최신 상태를 확인해 주세요.';
      } else {
        status.textContent = error.message;
      }
    } finally {
      save.disabled = load.disabled = false;
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
})();
