/**
 * Điểm khởi động PWA: IndexedDB → Service Worker → Router → Sync.
 * Submit luôn ghi local trước, sau đó mới đồng bộ nếu online.
 */
import { APP_CONFIG, RESPONSE_STATUS } from './config.js';
import {
  initDB,
  saveResponse,
  getResponseById,
  getAllResponses,
  getSyncStats,
  createId,
  ensureDeviceId,
  getSetting,
  setSetting,
  clearSyncedHistory,
} from './db.js';
import { getApiUrl, isApiConfigured } from './api.js';
import { bindAutoSync, registerBackgroundSync, syncPendingResponses } from './sync.js';
import { loadSurvey, loadSurveys, renderHomeSurveys, renderSurveyDetail, renderSurveyList } from './survey.js';
import {
  collectAnswers,
  renderHistoryDetail,
  renderSuccessPage,
  renderSurveyForm,
  showFormErrors,
  validateAnswers,
  clearFormErrors,
} from './form.js';
import { matchRoute, startRouter } from './router.js';
import {
  escapeHtml,
  firstAnswerPreview,
  formatDateTime,
  renderBadge,
  renderEmpty,
  renderError,
  renderLoading,
  setActiveNav,
  setNetworkChrome,
  setPendingBadge,
  toast,
} from './ui.js';

const view = () => document.querySelector('#view');
let installPrompt = null;

async function boot() {
  applyRuntimeMode();
  setNetworkChrome(navigator.onLine);
  bindNetworkUi();
  bindInstallPrompt();

  try {
    await initDB();
    await loadSurveys();
  } catch (error) {
    console.error(error);
    toast('Không khởi tạo được dữ liệu local.', 'danger');
  }

  await refreshPendingBadge();
  await registerServiceWorker();
  bindAutoSync();
  bindGlobalEvents();
  startRouter(renderRoute);

  window.setTimeout(() => {
    document.getElementById('splash')?.classList.add('is-hidden');
  }, 700);

  if (navigator.onLine) {
    syncPendingResponses({ silent: true });
  }
}

function bindGlobalEvents() {
  window.addEventListener('responses:changed', refreshPendingBadge);
  window.addEventListener('sync:message', (event) => {
    const { type, text } = event.detail || {};
    toast(text, type || 'info');
    refreshCurrentIfNeeded();
  });
  window.addEventListener('sync:done', async () => {
    await refreshPendingBadge();
    refreshCurrentIfNeeded();
  });
}

function refreshCurrentIfNeeded() {
  const hash = window.location.hash || '#/';
  if (hash === '#/' || hash.startsWith('#/sync') || hash.startsWith('#/history') || hash.startsWith('#/success')) {
    renderRoute({ parts: (hash.replace(/^#/, '') || '/').split('/').filter(Boolean) });
  }
}

async function renderRoute({ parts }) {
  const route = matchRoute(parts);
  const navMap = {
    home: 'home',
    surveys: 'surveys',
    detail: 'surveys',
    form: 'surveys',
    success: 'history',
    history: 'history',
    'history-detail': 'history',
    sync: 'sync',
    settings: 'home',
  };
  setActiveNav(navMap[route.name] || 'home');

  try {
    switch (route.name) {
      case 'home':
        view().innerHTML = await renderHome();
        bindHome();
        break;
      case 'surveys':
        view().innerHTML = renderSurveyList(await loadSurveys());
        break;
      case 'detail':
        view().innerHTML = renderSurveyDetail(await loadSurvey(route.id));
        break;
      case 'form':
        await renderFormRoute(route.id);
        break;
      case 'success':
        await renderSuccessRoute(route.id);
        break;
      case 'history':
        view().innerHTML = await renderHistory();
        break;
      case 'history-detail':
        await renderHistoryDetailRoute(route.id);
        break;
      case 'sync':
        view().innerHTML = await renderSyncPage();
        bindSyncPage();
        break;
      case 'settings':
        view().innerHTML = await renderSettings();
        bindSettings();
        break;
      default:
        view().innerHTML = renderError('Không tìm thấy trang', 'Đường dẫn không tồn tại.');
    }
  } catch (error) {
    console.error(error);
    view().innerHTML = renderError('Có lỗi xảy ra', error.message || 'Vui lòng thử lại.');
  }
}

async function renderHome() {
  const surveys = await loadSurveys();
  const stats = await getSyncStats();
  const pending = (stats.pending || 0) + (stats.failed || 0) + (stats.syncing || 0);
  const online = navigator.onLine;

  return `
    <section class="page home-page">
      <header class="hero">
        <p class="brand-kicker">VKU · Web + App</p>
        <h1>Field Survey</h1>
        <p>Một codebase Progressive Web App: mở trên trình duyệt (web) hoặc cài ra màn hình chính (app). Offline-first, dữ liệu lưu trên thiết bị trước khi đồng bộ.</p>
        <div class="status-row">
          <span class="network-pill ${online ? '' : 'is-offline'}" data-network-pill>
            <span class="dot"></span> ${online ? 'Online' : 'Offline'}
          </span>
          <a class="ghost-link" href="#/settings">Cài đặt</a>
        </div>
      </header>

      ${
        online
          ? ''
          : `<aside class="callout">
              Bạn vẫn có thể thực hiện khảo sát. Dữ liệu sẽ được lưu trên thiết bị và tự động đồng bộ khi có Internet.
            </aside>`
      }

      ${renderInstallCard()}

      <div class="stack">${renderHomeSurveys(surveys)}</div>

      <aside class="card sync-mini">
        <div>
          <strong>📤 Đang chờ đồng bộ: ${pending} bản ghi</strong>
          <p>${pending ? 'Bấm đồng bộ ngay khi đã có mạng và đã dán URL Apps Script.' : 'Không có bản ghi nào đang chờ.'}</p>
        </div>
        <button class="btn btn-secondary" id="home-sync" ${pending ? '' : 'disabled'}>Đồng bộ ngay</button>
      </aside>
    </section>
  `;
}

function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function applyRuntimeMode() {
  const appMode = isStandaloneApp();
  document.body.classList.toggle('is-app', appMode);
  document.body.classList.toggle('is-web', !appMode);
  document.querySelectorAll('[data-runtime-mode]').forEach((el) => {
    el.textContent = appMode ? 'App' : 'Web';
    el.classList.toggle('is-app', appMode);
  });
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function renderInstallCard() {
  if (isStandaloneApp()) {
    return `
      <aside class="card install-card">
        <strong>✓ Đang chạy như ứng dụng</strong>
        <p>Bạn đã mở từ icon màn hình chính. Vào Cài đặt để dán URL Apps Script trên máy này.</p>
      </aside>
    `;
  }

  const secure = window.isSecureContext;
  const canPrompt = Boolean(installPrompt);

  if (!secure) {
    return `
      <aside class="card install-card">
        <strong>Cài như ứng dụng</strong>
        <p>Đang mở bằng HTTP nên trình duyệt không cho cài ra Home Screen. Đưa app lên HTTPS (Netlify Drop / tunnel) rồi mở lại trên điện thoại.</p>
        <p class="muted">Xem <code>docs/run-on-phone.md</code> — mục Cách B.</p>
      </aside>
    `;
  }

  if (isIos()) {
    return `
      <aside class="card install-card">
        <strong>Cài ra màn hình chính (iPhone)</strong>
        <p>Mở bằng Safari → nút Chia sẻ → <b>Thêm vào Màn hình chính</b> → Thêm. Sau đó mở icon Field Survey.</p>
      </aside>
    `;
  }

  return `
    <aside class="card install-card">
      <strong>Cài như ứng dụng</strong>
      <p>Cài ra màn hình chính để mở kiểu app, không cần thanh địa chỉ trình duyệt.</p>
      <button class="btn btn-primary btn-block" data-install-app ${canPrompt ? '' : 'hidden'}>Cài lên màn hình chính</button>
      <p class="muted" ${canPrompt ? 'hidden' : ''}>Trên Android: Chrome → menu ⋮ → <b>Cài đặt ứng dụng</b> / Thêm vào màn hình chính.</p>
    </aside>
  `;
}

function bindInstallButtons() {
  document.querySelectorAll('[data-install-app]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      document.querySelectorAll('[data-install-app]').forEach((el) => {
        el.hidden = true;
      });
      toast('Nếu bạn chọn Cài đặt, icon sẽ xuất hiện trên màn hình chính.', 'success');
    });
  });
}

function bindHome() {
  bindInstallButtons();
  document.getElementById('home-sync')?.addEventListener('click', async () => {
    const result = await syncPendingResponses();
    if (result.skipped && result.reason === 'offline') {
      toast('Bạn đang offline. Bản ghi vẫn được giữ trên thiết bị.', 'warn');
    } else if (result.synced > 0) {
      toast(`Đồng bộ thành công ${result.synced} bản ghi`, 'success');
    }
    renderRoute({ parts: [] });
  });
}

async function renderFormRoute(id) {
  const survey = await loadSurvey(id);
  if (!survey) {
    view().innerHTML = renderError('Không tìm thấy khảo sát', 'Không thể mở form vì thiếu định nghĩa khảo sát.');
    return;
  }

  view().innerHTML = renderSurveyForm(survey);
  const form = document.getElementById('survey-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);
    const answers = collectAnswers(form, survey);
    const result = validateAnswers(survey, answers);
    if (!result.ok) {
      const first = Object.values(result.errors)[0];
      showFormErrors(form, result.errors, first);
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang lưu...';

    try {
      const record = await persistSubmission(survey, answers);
      window.location.hash = `/success/${record.id}`;
    } catch (error) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Gửi khảo sát';
      showFormErrors(form, {}, error.message);
    }
  });
}

/**
 * Offline-first: LUÔN ghi IndexedDB trước.
 * Online thì thử sync ngay; offline thì status=pending.
 */
async function persistSubmission(survey, answers) {
  const record = {
    id: createId(),
    surveyId: survey.id,
    surveyTitle: survey.title,
    answers,
    submittedAt: new Date().toISOString(),
    status: RESPONSE_STATUS.PENDING,
    deviceId: await ensureDeviceId(),
    syncAttempts: 0,
    lastSyncAttempt: null,
    lastError: null,
  };

  await saveResponse(record);
  await registerBackgroundSync();

  if (navigator.onLine) {
    await syncPendingResponses({ silent: true });
  }

  return (await getResponseById(record.id)) || record;
}

async function renderSuccessRoute(id) {
  const response = await getResponseById(id);
  const survey = response ? await loadSurvey(response.surveyId) : null;
  view().innerHTML = renderSuccessPage(response, survey, navigator.onLine);
}

async function renderHistory() {
  const items = await getAllResponses();
  if (!items.length) {
    return `
      <section class="page">
        <header class="page-header">
          <h1>Lịch sử</h1>
        </header>
        ${renderEmpty('Chưa có bài gửi', 'Các khảo sát bạn nộp trên thiết bị này sẽ xuất hiện tại đây.')}
      </section>
    `;
  }

  const rows = items
    .map((item) => {
      return `
        <a class="card list-row" href="#/history/${encodeURIComponent(item.id)}">
          <div>
            <h3>${escapeHtml(item.surveyTitle || item.surveyId)}</h3>
            <p>${escapeHtml(firstAnswerPreview(item.answers))}</p>
            <small>${escapeHtml(formatDateTime(item.submittedAt))}</small>
          </div>
          ${renderBadge(item.status)}
        </a>
      `;
    })
    .join('');

  return `
    <section class="page">
      <header class="page-header">
        <h1>Lịch sử</h1>
        <p>Dữ liệu lấy từ IndexedDB trên thiết bị này.</p>
      </header>
      <div class="stack">${rows}</div>
    </section>
  `;
}

async function renderHistoryDetailRoute(id) {
  const response = await getResponseById(id);
  const survey = response ? await loadSurvey(response.surveyId) : null;
  view().innerHTML = renderHistoryDetail(response, survey);
}

async function renderSyncPage() {
  const stats = await getSyncStats();
  const configured = await isApiConfigured();
  const pending = (stats.pending || 0) + (stats.failed || 0);

  return `
    <section class="page">
      <header class="page-header">
        <h1>Đồng bộ dữ liệu</h1>
        <p>Hàng đợi local được giữ nguyên cho đến khi Google Sheets xác nhận thành công.</p>
      </header>
      <div class="stats-grid">
        <article class="stat"><span>✓</span><strong>${stats.synced || 0}</strong><small>Đã đồng bộ</small></article>
        <article class="stat"><span>⏳</span><strong>${stats.pending || 0}</strong><small>Chờ đồng bộ</small></article>
        <article class="stat"><span>↻</span><strong>${stats.syncing || 0}</strong><small>Đang đồng bộ</small></article>
        <article class="stat"><span>⚠</span><strong>${stats.failed || 0}</strong><small>Lỗi</small></article>
      </div>
      ${
        configured
          ? ''
          : '<aside class="callout">Chưa có URL Apps Script. Vào Cài đặt để dán URL Web App trước khi đồng bộ.</aside>'
      }
      <button class="btn btn-primary btn-block btn-lg" id="sync-now" ${pending ? '' : 'disabled'}>Đồng bộ ngay</button>
    </section>
  `;
}

function bindSyncPage() {
  document.getElementById('sync-now')?.addEventListener('click', async (event) => {
    const btn = event.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Đang đồng bộ...';
    const result = await syncPendingResponses();
    if (result.skipped && result.reason === 'offline') {
      toast('Không thể đồng bộ khi offline.', 'warn');
    } else if (result.synced > 0) {
      toast(`Đồng bộ thành công ${result.synced} bản ghi`, 'success');
    } else if (result.failed > 0) {
      toast('Đồng bộ chưa thành công. Bản ghi vẫn được giữ local.', 'warn');
    }
    view().innerHTML = await renderSyncPage();
    bindSyncPage();
  });
}

async function renderSettings() {
  const deviceId = await ensureDeviceId();
  const apiUrl = await getApiUrl();
  const token = (await getSetting('syncToken', '')) || APP_CONFIG.SYNC_TOKEN;

  return `
    <section class="page">
      <header class="page-header">
        <h1>Cài đặt / Giới thiệu</h1>
        <p>${escapeHtml(APP_CONFIG.APP_FULL_NAME)} · phiên bản ${escapeHtml(APP_CONFIG.VERSION)}</p>
      </header>
      <form id="settings-form" class="card form-card">
        <div class="field">
          <label class="field-label" for="api-url">Google Apps Script URL</label>
          <input class="control" id="api-url" name="apiUrl" type="url" placeholder="https://script.google.com/macros/s/.../exec" value="${escapeHtml(apiUrl)}">
          <small>Chỉ lưu trên thiết bị. Không commit URL production nếu không cần.</small>
        </div>
        <div class="field">
          <label class="field-label" for="sync-token">SYNC_TOKEN (tuỳ chọn)</label>
          <input class="control" id="sync-token" name="syncToken" type="text" value="${escapeHtml(token)}" autocomplete="off">
        </div>
        <button class="btn btn-primary btn-block" type="submit">Lưu cấu hình</button>
      </form>
      <div class="card">
        <p class="mono muted">Device ID: ${escapeHtml(deviceId)}</p>
        <button class="btn btn-ghost btn-block" data-install-app ${installPrompt && !isStandaloneApp() ? '' : 'hidden'}>Cài lên màn hình chính</button>
        <button class="btn btn-ghost btn-block" id="clear-synced">Xóa lịch sử đã đồng bộ</button>
      </div>
      <div class="card about-card">
        <h3>Web và App cùng một project</h3>
        <p>Đây là PWA đa nền tảng: cùng HTML/CSS/JS chạy trên Chrome/Edge/Safari (website) và khi cài Home Screen thì <code>display: standalone</code> như ứng dụng. Không viết hai project riêng.</p>
        <p>Chế độ hiện tại: <strong>${isStandaloneApp() ? 'Ứng dụng (standalone)' : 'Website (trình duyệt)'}</strong></p>
      </div>
      <div class="card about-card">
        <h3>Giới hạn bảo mật</h3>
        <p>Apps Script Web App + Google Sheets không phải backend có xác thực người dùng. URL và token đều nằm trên client nên chỉ phù hợp bài tập / nội bộ.</p>
      </div>
    </section>
  `;
}

function bindSettings() {
  bindInstallButtons();
  document.getElementById('settings-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    await setSetting('apiUrl', form.apiUrl.value.trim());
    await setSetting('syncToken', form.syncToken.value.trim());
    toast('Đã lưu cấu hình trên thiết bị.', 'success');
  });

  document.getElementById('clear-synced')?.addEventListener('click', async () => {
    const count = await clearSyncedHistory();
    toast(count ? `Đã xóa ${count} bản ghi đã đồng bộ.` : 'Không có bản ghi synced để xóa.', 'info');
  });

}

async function refreshPendingBadge() {
  const stats = await getSyncStats();
  const pending = (stats.pending || 0) + (stats.failed || 0) + (stats.syncing || 0);
  setPendingBadge(pending);
}

function bindNetworkUi() {
  const update = () => setNetworkChrome(navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
}

function bindInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    document.querySelectorAll('[data-install-app]').forEach((btn) => {
      btn.hidden = false;
    });
  });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js');
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  } catch (error) {
    console.warn('Không đăng ký được Service Worker.', error);
  }
}

boot();
