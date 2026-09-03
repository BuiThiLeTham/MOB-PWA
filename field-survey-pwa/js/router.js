/**
 * Hash router — hoạt động offline, không cần cấu hình rewrite phía server.
 * Ví dụ: #/survey/facility-001/form
 */
export function parseHash() {
  const raw = (window.location.hash || '#/').replace(/^#/, '');
  const path = raw.split('?')[0] || '/';
  const parts = path.split('/').filter(Boolean);
  return { path: `/${parts.join('/')}`, parts };
}

export function navigate(to) {
  const hash = to.startsWith('#') ? to : `#${to}`;
  if (window.location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  window.location.hash = hash.startsWith('#') ? hash.slice(1) === '' ? '/' : hash.replace(/^#/, '') : to;
  if (!window.location.hash) {
    window.location.hash = to.startsWith('#') ? to : `#${to}`;
  }
}

export function startRouter(render) {
  const handle = () => {
    const parsed = parseHash();
    render(parsed);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  };

  window.addEventListener('hashchange', handle);
  if (!window.location.hash) {
    window.location.hash = '/';
  } else {
    handle();
  }
}

export function matchRoute(parts) {
  if (parts.length === 0) return { name: 'home' };
  if (parts[0] === 'surveys') return { name: 'surveys' };
  if (parts[0] === 'history' && parts[1]) return { name: 'history-detail', id: parts[1] };
  if (parts[0] === 'history') return { name: 'history' };
  if (parts[0] === 'sync') return { name: 'sync' };
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'success' && parts[1]) return { name: 'success', id: parts[1] };
  if (parts[0] === 'survey' && parts[1] && parts[2] === 'form') {
    return { name: 'form', id: parts[1] };
  }
  if (parts[0] === 'survey' && parts[1]) return { name: 'detail', id: parts[1] };
  return { name: 'notfound' };
}
