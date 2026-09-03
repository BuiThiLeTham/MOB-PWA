/**
 * Tải và hiển thị khảo sát.
 * Network-First khi online (API hoặc surveys.json), fallback IndexedDB / file local.
 */
import { APP_CONFIG } from './config.js';
import { getAllSurveys, getSurveyById, putSurveys } from './db.js';
import { fetchRemoteSurveys, isApiConfigured } from './api.js';
import { escapeHtml, renderEmpty, renderError, renderLoading } from './ui.js';

let memorySurveys = [];

export async function loadSurveys({ forceNetwork = false } = {}) {
  const cached = await getAllSurveys();
  if (cached.length) memorySurveys = cached;

  if (navigator.onLine || forceNetwork) {
    try {
      const remote = (await isApiConfigured()) ? await fetchRemoteSurveys() : null;
      if (remote?.length) {
        await putSurveys(remote);
        memorySurveys = remote;
        return remote;
      }

      const local = await fetchBundledSurveys();
      if (local.length) {
        await putSurveys(local);
        memorySurveys = local;
        return local;
      }
    } catch (error) {
      console.warn('Không lấy được khảo sát mới, dùng cache.', error);
    }
  }

  if (cached.length) return cached;

  const bundled = await fetchBundledSurveys();
  if (bundled.length) {
    await putSurveys(bundled);
    memorySurveys = bundled;
  }
  return bundled;
}

async function fetchBundledSurveys() {
  const response = await fetch(APP_CONFIG.SURVEYS_PATH, { cache: 'reload' });
  if (!response.ok) throw new Error('Không đọc được surveys.json');
  const payload = await response.json();
  return Array.isArray(payload.surveys) ? payload.surveys : [];
}

export async function loadSurvey(id) {
  const fromDb = await getSurveyById(id);
  if (fromDb) return fromDb;
  if (!memorySurveys.length) await loadSurveys();
  return memorySurveys.find((item) => item.id === id) || null;
}

export function renderSurveyList(surveys, { heading = 'Danh sách khảo sát' } = {}) {
  if (!surveys?.length) {
    return renderEmpty('Chưa có khảo sát', 'Dữ liệu khảo sát sẽ xuất hiện khi ứng dụng tải được file JSON hoặc Google Sheets.');
  }

  const cards = surveys
    .map(
      (survey) => `
      <article class="card survey-card">
        <div class="card-kicker">${escapeHtml(survey.category || 'Khảo sát')}</div>
        <h3>${escapeHtml(survey.title)}</h3>
        <p>${escapeHtml(survey.description || '')}</p>
        <div class="card-meta">
          <span>${survey.questions?.length || 0} câu hỏi</span>
          <span>${survey.estimatedMinutes || 3} phút</span>
        </div>
        <a class="btn btn-primary" href="#/survey/${encodeURIComponent(survey.id)}">Xem chi tiết</a>
      </article>
    `
    )
    .join('');

  return `
    <section class="page">
      <header class="page-header">
        <h1>${escapeHtml(heading)}</h1>
        <p>Chọn một cuộc khảo sát để bắt đầu. Bạn vẫn làm được khi đang offline.</p>
      </header>
      <div class="stack">${cards}</div>
    </section>
  `;
}

export function renderSurveyDetail(survey) {
  if (!survey) {
    return renderError('Không tìm thấy khảo sát', 'Mã khảo sát không tồn tại trên thiết bị này.');
  }

  const questions = (survey.questions || [])
    .map(
      (q, index) => `
      <li>
        <span class="q-index">${index + 1}</span>
        <div>
          <strong>${escapeHtml(q.label)}</strong>
          <small>${escapeHtml(labelForType(q.type))}${q.required ? ' · bắt buộc' : ''}</small>
        </div>
      </li>
    `
    )
    .join('');

  return `
    <section class="page">
      <a class="back-link" href="#/surveys">← Danh sách khảo sát</a>
      <header class="page-header">
        <p class="card-kicker">${escapeHtml(survey.category || 'Khảo sát')}</p>
        <h1>${escapeHtml(survey.title)}</h1>
        <p>${escapeHtml(survey.description || '')}</p>
      </header>
      <div class="card">
        <div class="card-meta">
          <span>${survey.questions?.length || 0} câu hỏi</span>
          <span>~${survey.estimatedMinutes || 3} phút</span>
        </div>
        <ul class="question-preview">${questions}</ul>
        <a class="btn btn-primary btn-block" href="#/survey/${encodeURIComponent(survey.id)}/form">Bắt đầu khảo sát</a>
      </div>
    </section>
  `;
}

export function renderHomeSurveys(surveys) {
  if (!surveys?.length) return renderLoading('Đang chuẩn bị khảo sát...');
  return surveys
    .map(
      (survey) => `
      <article class="card survey-card">
        <div class="card-kicker">${escapeHtml(survey.category || 'Khảo sát')}</div>
        <h3>${escapeHtml(survey.title)}</h3>
        <p>${survey.questions?.length || 0} câu hỏi</p>
        <a class="btn btn-primary" href="#/survey/${encodeURIComponent(survey.id)}/form">Bắt đầu</a>
      </article>
    `
    )
    .join('');
}

function labelForType(type) {
  const map = {
    text: 'Văn bản',
    textarea: 'Đoạn văn',
    number: 'Số',
    radio: 'Chọn một',
    checkbox: 'Chọn nhiều',
    select: 'Danh sách',
    date: 'Ngày',
    time: 'Giờ',
    rating: 'Đánh giá',
    yesno: 'Có / Không',
  };
  return map[type] || type;
}
