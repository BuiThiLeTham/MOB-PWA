/**
 * IndexedDB layer — FieldSurveyDB
 *
 * Object stores:
 *   surveys    — định nghĩa khảo sát (cache offline)
 *   responses  — câu trả lời đã nộp trên thiết bị
 *   syncQueue  — hàng đợi đồng bộ (tham chiếu response)
 *   settings   — deviceId, API URL ghi đè, v.v.
 *
 * Dữ liệu sống sót khi reload trang và đóng trình duyệt.
 */
import { APP_CONFIG, RESPONSE_STATUS } from './config.js';

const STORES = {
  SURVEYS: 'surveys',
  RESPONSES: 'responses',
  SYNC_QUEUE: 'syncQueue',
  SETTINGS: 'settings',
};

let dbPromise = null;

function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(APP_CONFIG.DB_NAME, APP_CONFIG.DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.SURVEYS)) {
        db.createObjectStore(STORES.SURVEYS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.RESPONSES)) {
        const responses = db.createObjectStore(STORES.RESPONSES, { keyPath: 'id' });
        responses.createIndex('by_status', 'status', { unique: false });
        responses.createIndex('by_survey', 'surveyId', { unique: false });
        responses.createIndex('by_submitted', 'submittedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const queue = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
        queue.createIndex('by_response', 'responseId', { unique: true });
      }

      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

function reqDone(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, handler) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  const result = handler(store, tx);
  await txDone(tx);
  return result;
}

export async function initDB() {
  await openDatabase();
  await ensureDeviceId();
  await resetStuckSyncing();
}

export async function putSurveys(surveys) {
  const db = await openDatabase();
  const tx = db.transaction(STORES.SURVEYS, 'readwrite');
  const store = tx.objectStore(STORES.SURVEYS);
  surveys.forEach((survey) => {
    store.put({
      ...survey,
      cachedAt: new Date().toISOString(),
    });
  });
  await txDone(tx);
}

export async function getAllSurveys() {
  return withStore(STORES.SURVEYS, 'readonly', (store) => reqDone(store.getAll()));
}

export async function getSurveyById(id) {
  return withStore(STORES.SURVEYS, 'readonly', (store) => reqDone(store.get(id)));
}

export async function saveResponse(response) {
  await withStore(STORES.RESPONSES, 'readwrite', (store) => store.put(response));

  if (response.status === RESPONSE_STATUS.PENDING || response.status === RESPONSE_STATUS.FAILED) {
    await enqueueSync(response.id);
  }

  notifyResponsesChanged();
  return response;
}

export async function getResponseById(id) {
  return withStore(STORES.RESPONSES, 'readonly', (store) => reqDone(store.get(id)));
}

export async function getAllResponses() {
  const items = await withStore(STORES.RESPONSES, 'readonly', (store) => reqDone(store.getAll()));
  return (items || []).sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
}

export async function getResponsesByStatus(status) {
  const db = await openDatabase();
  const tx = db.transaction(STORES.RESPONSES, 'readonly');
  const index = tx.objectStore(STORES.RESPONSES).index('by_status');
  const items = await reqDone(index.getAll(status));
  await txDone(tx);
  return items || [];
}

export async function updateResponse(id, patch) {
  const current = await getResponseById(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  await withStore(STORES.RESPONSES, 'readwrite', (store) => store.put(next));
  notifyResponsesChanged();
  return next;
}

export async function getSyncStats() {
  const all = await getAllResponses();
  return all.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    {
      total: 0,
      [RESPONSE_STATUS.PENDING]: 0,
      [RESPONSE_STATUS.SYNCING]: 0,
      [RESPONSE_STATUS.SYNCED]: 0,
      [RESPONSE_STATUS.FAILED]: 0,
    }
  );
}

export async function getUnsyncedResponses() {
  const pending = await getResponsesByStatus(RESPONSE_STATUS.PENDING);
  const failed = await getResponsesByStatus(RESPONSE_STATUS.FAILED);
  const syncing = await getResponsesByStatus(RESPONSE_STATUS.SYNCING);
  return [...pending, ...failed, ...syncing];
}

export async function enqueueSync(responseId) {
  const entry = {
    id: `queue-${responseId}`,
    responseId,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  await withStore(STORES.SYNC_QUEUE, 'readwrite', (store) => store.put(entry));
}

export async function getSyncQueue() {
  return withStore(STORES.SYNC_QUEUE, 'readonly', (store) => reqDone(store.getAll()));
}

export async function removeFromSyncQueue(responseId) {
  await withStore(STORES.SYNC_QUEUE, 'readwrite', (store) => store.delete(`queue-${responseId}`));
}

export async function getSetting(key, fallback = null) {
  const row = await withStore(STORES.SETTINGS, 'readonly', (store) => reqDone(store.get(key)));
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  await withStore(STORES.SETTINGS, 'readwrite', (store) => store.put({ key, value }));
}

export async function ensureDeviceId() {
  let deviceId = await getSetting('deviceId');
  if (!deviceId) {
    deviceId = createId();
    await setSetting('deviceId', deviceId);
  }
  return deviceId;
}

/**
 * Nếu app bị đóng giữa lúc đang sync, trả record về pending để retry.
 */
async function resetStuckSyncing() {
  const stuck = await getResponsesByStatus(RESPONSE_STATUS.SYNCING);
  await Promise.all(
    stuck.map((item) =>
      updateResponse(item.id, {
        status: RESPONSE_STATUS.PENDING,
        lastSyncAttempt: item.lastSyncAttempt || null,
      })
    )
  );
}

export async function clearSyncedHistory() {
  const synced = await getResponsesByStatus(RESPONSE_STATUS.SYNCED);
  const db = await openDatabase();
  const tx = db.transaction(STORES.RESPONSES, 'readwrite');
  const store = tx.objectStore(STORES.RESPONSES);
  synced.forEach((item) => store.delete(item.id));
  await txDone(tx);
  notifyResponsesChanged();
  return synced.length;
}

export function createId() {
  if (globalThis.crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function notifyResponsesChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('responses:changed'));
  }
}

export { STORES };
