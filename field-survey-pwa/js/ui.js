/**
 * Thành phần giao diện dùng chung: toast, badge trạng thái, empty/error/loading.
 */
import { RESPONSE_STATUS } from './config.js';

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function statusMeta(status) {
  switch (status) {
    case RESPONSE_STATUS.SYNCED:
      return { icon: '✓', label: 'Đã đồng bộ', className: 'badge-success' };
    case RESPONSE_STATUS.PENDING:
      return { icon: '⏳', label: 'Chờ đồng bộ', className: 'badge-warn' };
    case RESPONSE_STATUS.SYNCING:
      return { icon: '↻', label: 'Đang đồng bộ', className: 'badge-info' };
    case RESPONSE_STATUS.FAILED:
      return { icon: '⚠', label: 'Đồng bộ thất bại', className: 'badge-danger' };
    default:
      return { icon: '•', label: status, className: 'badge-muted' };
  }
}

export function renderBadge(status) {
  const meta = statusMeta(status);
  return `<span class="badge ${meta.className}">${meta.icon} ${escapeHtml(meta.label)}</span>`;
}

export function toast(message, type = 'info') {
  const root = qs('#toast-root');
  if (!root) return;

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  root.appendChild(el);

  requestAnimationFrame(() => el.classList.add('is-visible'));
  window.setTimeout(() => {
    el.classList.remove('is-visible');
    window.setTimeout(() => el.remove(), 280);
  }, 3200);
}

export function setNetworkChrome(online) {
  const pills = document.querySelectorAll('[data-network-pill]');
  pills.forEach((pill) => {
    pill.classList.toggle('is-offline', !online);
    pill.innerHTML = online
      ? '<span class="dot"></span> Online'
      : '<span class="dot"></span> Offline';
  });

  const banner = qs('#offline-banner');
  if (banner) {
    banner.hidden = online;
  }
}

export function renderLoading(text = 'Đang tải...') {
  return `
    <div class="state-block" role="status">
      <div class="spinner" aria-hidden="true"></div>
      <p>${escapeHtml(text)}</p>
    </div>
  `;
}

export function renderEmpty(title, detail) {
  return `
    <div class="state-block">
      <div class="state-icon" aria-hidden="true">📭</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(detail)}</p>
    </div>
  `;
}

export function renderError(title, detail) {
  return `
    <div class="state-block state-error">
      <div class="state-icon" aria-hidden="true">⚠</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(detail)}</p>
    </div>
  `;
}

export function firstAnswerPreview(answers) {
  if (!answers || typeof answers !== 'object') return 'Không có dữ liệu';
  const value = Object.values(answers).find((item) => {
    if (Array.isArray(item)) return item.length > 0;
    return String(item || '').trim() !== '';
  });
  if (Array.isArray(value)) return value.join(', ');
  return String(value || 'Không có dữ liệu');
}

export function setPendingBadge(count) {
  document.querySelectorAll('[data-pending-count]').forEach((el) => {
    const n = Number(count) || 0;
    el.hidden = n <= 0;
    el.textContent = String(n);
  });
}

export function setActiveNav(routeName) {
  document.querySelectorAll('[data-nav]').forEach((link) => {
    link.classList.toggle('is-active', link.dataset.nav === routeName);
  });
}
