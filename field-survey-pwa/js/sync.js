/**
 * Sync Manager
 *
 * Luồng:
 *   IndexedDB (status=pending|failed)
 *     → đánh dấu syncing
 *     → POST Google Apps Script
 *     → thành công: status=synced, xóa khỏi queue
 *     → thất bại: giữ local, status=failed/pending, retry sau
 *
 * Không xóa dữ liệu local trước khi server xác nhận.
 * Duplicate được xử lý phía server theo responseId.
 */
import { APP_CONFIG, RESPONSE_STATUS } from './config.js';
import {
  getUnsyncedResponses,
  updateResponse,
  removeFromSyncQueue,
  getSyncStats,
} from './db.js';
import { isApiConfigured, postResponse } from './api.js';

let syncing = false;

export async function registerBackgroundSync() {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await registration.sync.register(APP_CONFIG.SYNC_TAG);
      return true;
    }
  } catch (error) {
    console.warn('Background Sync không dùng được, fallback online event.', error);
  }
  return false;
}

export async function syncPendingResponses({ silent = false } = {}) {
  if (syncing) {
    return { skipped: true, reason: 'busy' };
  }

  if (!navigator.onLine) {
    return { skipped: true, reason: 'offline' };
  }

  if (!(await isApiConfigured())) {
    if (!silent) {
      window.dispatchEvent(
        new CustomEvent('sync:message', {
          detail: { type: 'warn', text: 'Chưa cấu hình Google Apps Script URL trong Cài đặt.' },
        })
      );
    }
    return { skipped: true, reason: 'no-api' };
  }

  const items = await getUnsyncedResponses();
  if (items.length === 0) {
    return { synced: 0, failed: 0 };
  }

  syncing = true;
  window.dispatchEvent(
    new CustomEvent('sync:start', { detail: { total: items.length } })
  );

  let synced = 0;
  let failed = 0;

  try {
    for (const record of items) {
      window.dispatchEvent(
        new CustomEvent('sync:progress', {
          detail: { id: record.id, total: items.length, synced, failed },
        })
      );

      const attempts = (record.syncAttempts || 0) + 1;
      await updateResponse(record.id, {
        status: RESPONSE_STATUS.SYNCING,
        syncAttempts: attempts,
        lastSyncAttempt: new Date().toISOString(),
      });

      try {
        const result = await postResponse(record);
        await updateResponse(record.id, {
          status: RESPONSE_STATUS.SYNCED,
          syncedAt: new Date().toISOString(),
          lastError: null,
          duplicate: Boolean(result.duplicate),
        });
        await removeFromSyncQueue(record.id);
        synced += 1;
      } catch (error) {
        const nextStatus =
          attempts >= APP_CONFIG.MAX_SYNC_ATTEMPTS
            ? RESPONSE_STATUS.FAILED
            : RESPONSE_STATUS.PENDING;
        await updateResponse(record.id, {
          status: nextStatus,
          lastError: error.message || 'Đồng bộ thất bại',
        });
        failed += 1;
      }
    }
  } finally {
    syncing = false;
    const stats = await getSyncStats();
    window.dispatchEvent(
      new CustomEvent('sync:done', { detail: { synced, failed, stats } })
    );
  }

  return { synced, failed };
}

export function bindAutoSync() {
  window.addEventListener('online', async () => {
    const stats = await getSyncStats();
    const waiting = (stats.pending || 0) + (stats.failed || 0);
    if (waiting > 0) {
      window.dispatchEvent(
        new CustomEvent('sync:message', {
          detail: { type: 'info', text: `Đã kết nối Internet. Đang đồng bộ ${waiting} bản ghi...` },
        })
      );
    }
    const usedBg = await registerBackgroundSync();
    if (!usedBg) {
      const result = await syncPendingResponses({ silent: true });
      announceResult(result);
    }
  });

  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', async (event) => {
      if (event.data?.type === 'SYNC_PLEASE') {
        const result = await syncPendingResponses({ silent: true });
        announceResult(result);
      }
    });
  }
}

function announceResult(result) {
  if (!result || result.skipped) return;
  if (result.synced > 0 && result.failed === 0) {
    window.dispatchEvent(
      new CustomEvent('sync:message', {
        detail: { type: 'success', text: `Đồng bộ thành công ${result.synced} bản ghi` },
      })
    );
  } else if (result.failed > 0) {
    window.dispatchEvent(
      new CustomEvent('sync:message', {
        detail: {
          type: 'warn',
          text: `Đồng bộ ${result.synced} thành công, ${result.failed} lỗi. Sẽ thử lại sau.`,
        },
      })
    );
  }
}
