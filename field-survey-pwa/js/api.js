/**
 * Tầng gọi Google Apps Script Web App.
 *
 * - Chỉ đọc URL từ config / Settings (không hard-code rải rác).
 * - Content-Type: text/plain để tránh CORS preflight với Apps Script.
 * - Request đồng bộ KHÔNG được Service Worker cache (network-only).
 */
import { APP_CONFIG } from './config.js';
import { getSetting } from './db.js';

export async function getApiUrl() {
  const override = await getSetting('apiUrl', '');
  return String(override || APP_CONFIG.GAS_WEB_APP_URL || '').trim();
}

export async function getSyncToken() {
  const override = await getSetting('syncToken', '');
  return String(override || APP_CONFIG.SYNC_TOKEN || '').trim();
}

export async function isApiConfigured() {
  return Boolean(await getApiUrl());
}

export async function healthCheck() {
  const url = await getApiUrl();
  if (!url) {
    return { ok: false, reason: 'missing-url' };
  }

  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Health check HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchRemoteSurveys() {
  const url = await getApiUrl();
  if (!url) return null;

  const response = await fetch(`${url}?action=surveys`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Không tải được khảo sát từ API (${response.status})`);
  }

  const payload = await response.json();
  if (!payload?.ok || !Array.isArray(payload.surveys)) {
    return null;
  }
  return payload.surveys;
}

/**
 * Gửi một response lên Google Sheets qua Apps Script.
 * Server phải idempotent theo responseId — client có thể gửi lại khi retry.
 */
export async function postResponse(record) {
  const url = await getApiUrl();
  if (!url) {
    const error = new Error('Chưa cấu hình Google Apps Script URL');
    error.code = 'NO_API';
    throw error;
  }

  const token = await getSyncToken();
  const body = {
    responseId: record.id,
    surveyId: record.surveyId,
    surveyTitle: record.surveyTitle || '',
    submittedAt: record.submittedAt,
    deviceId: record.deviceId,
    answers: record.answers,
    token,
  };

  const response = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Đồng bộ thất bại (HTTP ${response.status})`);
  }

  const payload = await response.json();
  if (!payload?.ok) {
    throw new Error(payload?.error || 'Apps Script từ chối bản ghi');
  }

  return payload;
}
