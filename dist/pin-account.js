(() => {
  const get = id => document.getElementById(id);
  const status = get('status');
  let csrf = null;
  let busy = false;

  async function request(path, method = 'GET', data) {
    const headers = {};
    if (data) headers['Content-Type'] = 'application/json';
    if (csrf && method !== 'GET') headers['X-CSRF-Token'] = csrf;
    const response = await fetch(path, {
      method, headers, cache: 'no-store', body: data ? JSON.stringify(data) : undefined
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '요청을 처리하지 못했습니다.');
    return result;
  }

  async function refresh() {
    const state = await request('/api/auth/me');
    csrf = state.csrf;
    get('guest').hidden = !state.pinReady || !!state.user;
    get('member').hidden = !state.user;
    get('pin-tools').hidden = !state.pinReady || !state.pinAccount;
    get('nickname').textContent = state.user?.nickname || '';
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
