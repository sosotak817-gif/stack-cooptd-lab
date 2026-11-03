(() => {
  const link = document.getElementById('home-account');
  const key = 'stack-lab-entry-choice-v1';
  const query = new URLSearchParams(location.search);
  function remember() {
    try { localStorage.setItem(key, '1'); } catch {}
  }
  async function refresh() {
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!response.ok) return;
      const state = await response.json();
      link.textContent = state.user?.nickname || '로그인';
      if (state.user) {
        remember();
        if (state.featuredBadge && window.StackLabBadge) {
          link.append(window.StackLabBadge.icon(state.featuredBadgeCode, state.featuredBadge));
        }
        return;
      }
      let entered = query.get('enter') === '1';
      try { entered ||= localStorage.getItem(key) === '1'; } catch {}
      if (!entered) location.replace('/account/?welcome=1');
    } catch {}
  }
  if (query.get('enter') === '1') remember();
  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
})();
