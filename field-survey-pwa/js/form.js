/**
 * Bộ render + validate form khảo sát.
 * Thêm loại câu hỏi mới: đăng ký vào QUESTION_RENDERERS.
 */
import { escapeHtml, formatDateTime, renderBadge, renderError } from './ui.js';

const QUESTION_RENDERERS = {
  text: renderText,
  textarea: renderTextarea,
  number: renderNumber,
  radio: renderRadio,
  checkbox: renderCheckbox,
  select: renderSelect,
  date: renderDate,
  time: renderTime,
  rating: renderRating,
  yesno: renderYesNo,
};

export function renderSurveyForm(survey) {
  const fields = (survey.questions || [])
    .map((question) => {
      const renderer = QUESTION_RENDERERS[question.type] || QUESTION_RENDERERS.text;
      return `
        <div class="field" data-field="${escapeHtml(question.id)}">
          <label class="field-label" for="field-${escapeHtml(question.id)}">
            ${escapeHtml(question.label)}
            ${question.required ? '<span class="req">*</span>' : ''}
          </label>
          ${renderer(question)}
          <p class="field-error" data-error-for="${escapeHtml(question.id)}" hidden></p>
        </div>
      `;
    })
    .join('');

  return `
    <section class="page">
      <a class="back-link" href="#/survey/${encodeURIComponent(survey.id)}">← Thông tin khảo sát</a>
      <header class="page-header">
        <h1>${escapeHtml(survey.title)}</h1>
        <p>Các câu có dấu * là bắt buộc. Bạn có thể gửi khi đang offline.</p>
      </header>
      <form id="survey-form" class="card form-card" novalidate>
        ${fields}
        <div id="form-alert" class="form-alert" hidden></div>
        <button type="submit" class="btn btn-primary btn-block btn-lg">Gửi khảo sát</button>
      </form>
    </section>
  `;
}

export function collectAnswers(form, survey) {
  const answers = {};
  for (const question of survey.questions || []) {
    answers[question.id] = readAnswer(form, question);
  }
  return answers;
}

export function validateAnswers(survey, answers) {
  const errors = {};
  for (const question of survey.questions || []) {
    const value = answers[question.id];
    const error = validateQuestion(question, value);
    if (error) errors[question.id] = error;
  }
  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}

export function showFormErrors(form, errors, message) {
  form.querySelectorAll('.field-error').forEach((el) => {
    el.hidden = true;
    el.textContent = '';
  });
  form.querySelectorAll('.field').forEach((el) => el.classList.remove('has-error'));

  Object.entries(errors).forEach(([id, text]) => {
    const field = form.querySelector(`[data-field="${id}"]`);
    const errorEl = form.querySelector(`[data-error-for="${id}"]`);
    if (field) field.classList.add('has-error');
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = text;
    }
  });

  const alert = form.querySelector('#form-alert');
  if (alert) {
    alert.hidden = false;
    alert.textContent = message || '⚠ Vui lòng kiểm tra các trường bị thiếu hoặc chưa hợp lệ.';
  }
}

export function clearFormErrors(form) {
  const alert = form.querySelector('#form-alert');
  if (alert) {
    alert.hidden = true;
    alert.textContent = '';
  }
}

export function renderSuccessPage(response, survey, online) {
  if (!response) {
    return renderError('Không tìm thấy bản ghi', 'Phản hồi vừa gửi không còn trên thiết bị.');
  }

  const offlineHint =
    response.status === 'synced'
      ? 'Ứng dụng đã lưu trên thiết bị và đồng bộ lên Google Sheets.'
      : online
        ? 'Đã lưu trên thiết bị. Bản ghi đang chờ đồng bộ — kiểm tra URL Apps Script trong Cài đặt nếu chưa cấu hình.'
        : 'Bạn đang offline. Dữ liệu sẽ được đồng bộ khi có Internet.';

  return `
    <section class="page">
      <div class="card success-card">
        <div class="success-icon" aria-hidden="true">✓</div>
        <h1>Đã lưu khảo sát trên thiết bị</h1>
        <p>${offlineHint}</p>
        ${renderBadge(response.status)}
        <dl class="kv">
          <div><dt>Khảo sát</dt><dd>${escapeHtml(survey?.title || response.surveyId)}</dd></div>
          <div><dt>Thời gian</dt><dd>${escapeHtml(formatDateTime(response.submittedAt))}</dd></div>
          <div><dt>Mã bản ghi</dt><dd class="mono">${escapeHtml(response.id)}</dd></div>
        </dl>
        <a class="btn btn-primary btn-block" href="#/">Về trang chủ</a>
        <a class="btn btn-ghost btn-block" href="#/history/${encodeURIComponent(response.id)}">Xem chi tiết</a>
      </div>
    </section>
  `;
}

export function renderHistoryDetail(response, survey) {
  if (!response) {
    return renderError('Không tìm thấy', 'Bản ghi này không tồn tại trong IndexedDB.');
  }

  const rows = Object.entries(response.answers || [])
    .map(([key, value]) => {
      const question = survey?.questions?.find((item) => item.id === key);
      const label = question?.label || key;
      const display = Array.isArray(value) ? value.join(', ') : String(value ?? '');
      return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(display || '—')}</dd></div>`;
    })
    .join('');

  return `
    <section class="page">
      <a class="back-link" href="#/history">← Lịch sử</a>
      <header class="page-header">
        <h1>${escapeHtml(survey?.title || response.surveyId)}</h1>
        ${renderBadge(response.status)}
      </header>
      <div class="card">
        <dl class="kv">
          <div><dt>Thời gian gửi</dt><dd>${escapeHtml(formatDateTime(response.submittedAt))}</dd></div>
          <div><dt>Mã</dt><dd class="mono">${escapeHtml(response.id)}</dd></div>
          ${response.lastError ? `<div><dt>Lỗi gần nhất</dt><dd>${escapeHtml(response.lastError)}</dd></div>` : ''}
          ${rows}
        </dl>
      </div>
    </section>
  `;
}

function readAnswer(form, question) {
  if (question.type === 'checkbox') {
    return [...form.querySelectorAll(`input[name="${question.id}"]:checked`)].map((el) => el.value);
  }
  if (question.type === 'rating') {
    const checked = form.querySelector(`input[name="${question.id}"]:checked`);
    return checked ? Number(checked.value) : '';
  }
  const field = form.elements.namedItem(question.id);
  if (!field) return '';
  return typeof field.value === 'string' ? field.value.trim() : field.value;
}

function validateQuestion(question, value) {
  const empty =
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);

  if (question.required && empty) {
    return `⚠ Vui lòng nhập ${question.label.toLowerCase()}`;
  }
  if (empty) return null;

  if (question.type === 'number') {
    const num = Number(value);
    if (Number.isNaN(num)) return '⚠ Giá trị phải là số';
    if (question.min != null && num < question.min) return `⚠ Giá trị tối thiểu là ${question.min}`;
    if (question.max != null && num > question.max) return `⚠ Giá trị tối đa là ${question.max}`;
  }

  if (question.type === 'rating') {
    const num = Number(value);
    if (num < 1 || num > (question.max || 5)) return '⚠ Vui lòng chọn mức đánh giá';
  }

  return null;
}

function inputAttrs(question, extra = '') {
  return `
    id="field-${escapeHtml(question.id)}"
    name="${escapeHtml(question.id)}"
    ${question.required ? 'required' : ''}
    ${extra}
  `;
}

function renderText(question) {
  return `<input class="control" type="text" ${inputAttrs(question)} placeholder="${escapeHtml(question.placeholder || '')}">`;
}

function renderTextarea(question) {
  return `<textarea class="control" rows="4" ${inputAttrs(question)} placeholder="${escapeHtml(question.placeholder || '')}"></textarea>`;
}

function renderNumber(question) {
  const min = question.min != null ? `min="${question.min}"` : '';
  const max = question.max != null ? `max="${question.max}"` : '';
  return `<input class="control" type="number" inputmode="numeric" ${inputAttrs(question, `${min} ${max}`)}>`;
}

function renderSelect(question) {
  const options = (question.options || [])
    .map((opt) => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`)
    .join('');
  return `
    <select class="control" ${inputAttrs(question)}>
      <option value="">— Chọn —</option>
      ${options}
    </select>
  `;
}

function renderDate(question) {
  return `<input class="control" type="date" ${inputAttrs(question)}>`;
}

function renderTime(question) {
  return `<input class="control" type="time" ${inputAttrs(question)}>`;
}

function renderRadio(question) {
  return `<div class="choice-list">${(question.options || [])
    .map(
      (opt, index) => `
      <label class="choice">
        <input type="radio" name="${escapeHtml(question.id)}" value="${escapeHtml(opt)}" ${index === 0 ? `id="field-${escapeHtml(question.id)}"` : ''}>
        <span>${escapeHtml(opt)}</span>
      </label>
    `
    )
    .join('')}</div>`;
}

function renderCheckbox(question) {
  return `<div class="choice-list">${(question.options || [])
    .map(
      (opt, index) => `
      <label class="choice">
        <input type="checkbox" name="${escapeHtml(question.id)}" value="${escapeHtml(opt)}" ${index === 0 ? `id="field-${escapeHtml(question.id)}"` : ''}>
        <span>${escapeHtml(opt)}</span>
      </label>
    `
    )
    .join('')}</div>`;
}

function renderRating(question) {
  const max = question.max || 5;
  const stars = Array.from({ length: max }, (_, i) => {
    const value = i + 1;
    return `
      <label class="star">
        <input type="radio" name="${escapeHtml(question.id)}" value="${value}">
        <span aria-hidden="true">★</span>
        <em>${value}</em>
      </label>
    `;
  }).join('');
  return `<div class="rating" role="radiogroup" aria-label="${escapeHtml(question.label)}">${stars}</div>`;
}

function renderYesNo(question) {
  return `
    <div class="yesno">
      <label class="choice choice-lg">
        <input type="radio" name="${escapeHtml(question.id)}" value="Có" id="field-${escapeHtml(question.id)}">
        <span>Có</span>
      </label>
      <label class="choice choice-lg">
        <input type="radio" name="${escapeHtml(question.id)}" value="Không">
        <span>Không</span>
      </label>
    </div>
  `;
}
