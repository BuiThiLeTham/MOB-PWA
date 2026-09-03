/**
 * Service Worker — Field Survey PWA
 *
 * Vòng đời:
 *   Register → Install (pre-cache App Shell)
 *            → Activate (xóa cache cũ)
 *            → Fetch (chọn chiến lược cache)
 *
 * Chiến lược:
 *   Cache-First   : HTML/CSS/JS/icons/manifest (App Shell) — app vẫn mở khi offline.
 *   Network-First : data/surveys.json — ưu tiên khảo sát mới, fallback cache.
 *   Network-Only  : POST/API Google Apps Script — không cache giao dịch đồng bộ.
 *
 * Background Sync:
 *   tag = sync-responses → nhờ các client (trang đang mở) chạy Sync Manager.
 *   Nếu không có client, SW tự đọc IndexedDB và POST.
 */
const CACHE_VERSION = 'field-survey-v1';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;
const DB_NAME = 'FieldSurveyDB';
const DB_VERSION = 1;
const SYNC_TAG = 'sync-responses';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/responsive.css',
  './js/app.js',
  './js/config.js',
  './js/db.js',
  './js/api.js',
  './js/sync.js',
  './js/survey.js',
  './js/form.js',
  './js/router.js',
  './js/ui.js',
  './data/surveys.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(APP_SHELL);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-Only: không chặn POST / request đồng bộ. Tránh cache transaction.
  if (request.method !== 'GET') {
    return;
  }

  if (isSyncEndpoint(url)) {
    return;
  }

  // Network-First: định nghĩa khảo sát có thể được admin cập nhật.
  if (isSurveyData(url)) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Cache-First: App Shell và tài nguyên tĩnh cùng origin.
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(handleBackgroundSync());
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isSyncEndpoint(url) {
  return url.hostname === 'script.google.com' || url.hostname.endsWith('googleusercontent.com');
}

function isSurveyData(url) {
  return url.pathname.endsWith('/data/surveys.json') || url.searchParams.get('action') === 'surveys';
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (error) {
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const shell = await caches.open(SHELL_CACHE);
    const bundled = await shell.match(request, { ignoreSearch: true });
    if (bundled) return bundled;
    throw error;
  }
}

async function handleBackgroundSync() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  if (clients.length) {
    clients.forEach((client) => client.postMessage({ type: 'SYNC_PLEASE' }));
    return;
  }
  await syncFromIndexedDB();
}

/**
 * Fallback khi không có tab nào đang mở: SW tự đọc FieldSurveyDB và POST.
 */
async function syncFromIndexedDB() {
  const db = await openFieldSurveyDB();
  if (!db) return;

  const apiUrl = await readSetting(db, 'apiUrl');
  const token = (await readSetting(db, 'syncToken')) || '';
  if (!apiUrl) return;

  const pending = await readUnsynced(db);
  for (const record of pending) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          responseId: record.id,
          surveyId: record.surveyId,
          surveyTitle: record.surveyTitle || '',
          submittedAt: record.submittedAt,
          deviceId: record.deviceId,
          answers: record.answers,
          token,
        }),
      });
      if (!response.ok) continue;
      const payload = await response.json();
      if (payload?.ok) {
        await writeResponse(db, {
          ...record,
          status: 'synced',
          syncedAt: new Date().toISOString(),
          lastError: null,
          duplicate: Boolean(payload.duplicate),
        });
      }
    } catch (error) {
      // Giữ pending — lần sau retry. Không xóa local.
      console.warn('SW sync failed', record.id, error);
    }
  }
}

function openFieldSurveyDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      // Schema do trang chính tạo. SW không migrate ở đây.
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbReq(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readSetting(db, key) {
  if (!db.objectStoreNames.contains('settings')) return '';
  const tx = db.transaction('settings', 'readonly');
  const row = await idbReq(tx.objectStore('settings').get(key));
  return row?.value || '';
}

async function readUnsynced(db) {
  if (!db.objectStoreNames.contains('responses')) return [];
  const tx = db.transaction('responses', 'readonly');
  const all = (await idbReq(tx.objectStore('responses').getAll())) || [];
  return all.filter((item) => item.status === 'pending' || item.status === 'failed');
}

async function writeResponse(db, record) {
  const tx = db.transaction('responses', 'readwrite');
  tx.objectStore('responses').put(record);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
