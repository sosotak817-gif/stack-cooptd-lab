(() => {
  const get = id => document.getElementById(id);
  const status = get('status');
  let csrf = null;
  let busy = false;

  async function request(path, method = 'GET', data, headers = {}) {
    if (data) headers['Content-Type'] = 'application/json';
    if (csrf && method !== 'GET') headers['X-CSRF-Token'] = csrf;
    const response = await fetch(path, {
      method, headers, cache: 'no-store', body: data ? JSON.stringify(data) : undefined
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '요청을 처리하지 못했습니다.');
    return result;
  }

  async function refreshActivity(user) {
    const puzzles = get('activity-puzzles');
    const guides = get('activity-guides');
    const activityStatus = get('activity-status');
    puzzles.replaceChildren();
    guides.replaceChildren();
    const totals = get('activity-totals');
    totals.textContent = '';
    activityStatus.textContent = '';
    if (!user) return;
    try {
      const activity = await request('/api/me/activity', 'GET', undefined, { 'X-Account-Id': user.id });
      const count = new Intl.NumberFormat('ko-KR');
      const { savedDecks, puzzleRecords, publishedGuides } = activity.stats;
      totals.textContent = '저장 덱 ' + count.format(savedDecks) + '개 · 퍼즐 최고 기록 ' +
        count.format(puzzleRecords) + '건 · 작성 공략 ' + count.format(publishedGuides) + '개';
      const date = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul' });
      const score = new Intl.NumberFormat('ko-KR', { style: 'percent', maximumFractionDigits: 2 });
      const append = (list, text) => {
        const item = document.createElement('li');
        item.textContent = text;
        list.append(item);
      };
      for (const row of activity.puzzles) {
        append(puzzles, date.format(row.achievedAt) + ' · ' + score.format(row.score / 100) + ' · 이동 ' + row.moves + '회');
      }
      for (const row of activity.guides) append(guides, row.title + ' · ' + date.format(row.updatedAt));
      if (!activity.puzzles.length) append(puzzles, '저장된 계정 퍼즐 기록이 없습니다.');
      if (!activity.guides.length) append(guides, '작성한 계정 공략이 없습니다.');
    } catch (error) {
      activityStatus.textContent = error.message;
    }
  }

  async function refresh() {
    const state = await request('/api/auth/me');
    csrf = state.csrf;
    get('guest').hidden = !state.pinReady || !!state.user;
    get('member').hidden = !state.user;
    get('pin-tools').hidden = !state.pinReady || !state.pinAccount;
    get('nickname').textContent = state.user?.nickname || '';
    await refreshActivity(state.user);
    const list = get('devices');
    const remove = get('remove-device');
    list.replaceChildren();
    remove.elements.device.replaceChildren();
    remove.hidden = true;
    if (!get('pin-tools').hidden) {
      const { devices } = await request('/api/devices');
      const formatDate = timestamp => new Date(timestamp).toLocaleDateString('ko-KR');
      for (const device of devices) {
        const item = document.createElement('li');
        const lastUsed = device.last_used_at ? formatDate(device.last_used_at) : '사용 기록 없음';
        item.textContent = device.name + ' · 등록 ' + formatDate(device.created_at) + ' · 최근 사용 ' + lastUsed + ' · 만료 ' + formatDate(device.expires_at);
        list.append(item);
        remove.elements.device.add(new Option(device.name, device.id));
      }
      remove.hidden = !devices.length;
    }
    return state.pinReady || state.user ? '' : '현재 PIN 계정 서비스를 사용할 수 없습니다.';
  }

  async function run(action, button) {
    if (busy) return;
    busy = true;
    if (button) button.disabled = true;
    status.textContent = '처리 중입니다.';
    try {
      status.textContent = await action();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      if (button) button.disabled = false;
      busy = false;
    }
  }

  for (const form of document.querySelectorAll('form')) {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const path = form.dataset.path || '/api/devices/' + encodeURIComponent(data.device);
      delete data.device;
      run(async () => {
        await request(path, form.dataset.method || 'POST', data);
        form.reset();
        await refresh();
        return '처리가 완료되었습니다.';
      }, event.submitter);
    });
  }
  get('check-name').addEventListener('click', event => {
    const button = event.currentTarget;
    const nickname = button.form.elements.nickname;
    if (!nickname.reportValidity()) return;
    run(async () => {
      const result = await request('/api/auth/nickname', 'POST', { nickname: nickname.value });
      return result.available ? '사용 가능한 닉네임입니다.' : '이미 사용 중인 닉네임입니다.';
    }, button);
  });
  run(refresh);
})();
