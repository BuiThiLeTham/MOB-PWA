/**
 * Field Survey PWA — Google Apps Script Web App
 *
 * Deploy:
 *   1. Tạo Google Sheet với 3 sheet: Surveys, Questions, Responses
 *      (hoặc chạy setupSheets() một lần).
 *   2. Extensions → Apps Script → dán file này.
 *   3. Project Settings → Script properties: SYNC_TOKEN (tuỳ chọn).
 *   4. Deploy → New deployment → Web app
 *        Execute as: Me
 *        Who has access: Anyone
 *   5. Copy URL .../exec vào Cài đặt của PWA.
 *
 * doGet  : health check + ?action=surveys
 * doPost : nhận JSON, ghi Responses, chống trùng responseId
 *
 * CORS: client gửi Content-Type text/plain để tránh preflight.
 */

var SHEET_SURVEYS = 'Surveys';
var SHEET_QUESTIONS = 'Questions';
var SHEET_RESPONSES = 'Responses';

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : '';
  if (action === 'surveys') {
    return json_({ ok: true, surveys: readSurveys_() });
  }
  return json_({
    ok: true,
    service: 'Field Survey API',
    version: '1.0.0'
  });
}

function doPost(e) {
  try {
    var raw = e.postData && e.postData.contents ? e.postData.contents : '{}';
    var data = JSON.parse(raw);

    var expected = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
    if (expected && data.token !== expected) {
      return json_({ ok: false, error: 'Token không hợp lệ' });
    }

    if (!data.responseId || !data.surveyId) {
      return json_({ ok: false, error: 'Thiếu responseId hoặc surveyId' });
    }

    setupSheets();
    var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_RESPONSES);
    var existingRow = findResponseRow_(sheet, String(data.responseId));

    // Idempotent: cùng responseId không tạo dòng mới.
    if (existingRow > 0) {
      return json_({ ok: true, duplicate: true, row: existingRow });
    }

    var answers = data.answers || {};
    var answersJson = JSON.stringify(answers);
    var submittedAt = data.submittedAt || new Date().toISOString();

    sheet.appendRow([
      String(data.responseId),
      String(data.surveyId),
      String(data.surveyTitle || ''),
      submittedAt,
      String(data.deviceId || ''),
      'synced',
      answersJson
    ]);

    flattenAnswers_(sheet, answers);
    return json_({ ok: true, duplicate: false });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

/**
 * Tạo header nếu chưa có. An toàn khi chạy nhiều lần.
 */
function setupSheets() {
  var ss = SpreadsheetApp.getActive();

  var surveys = ss.getSheetByName(SHEET_SURVEYS) || ss.insertSheet(SHEET_SURVEYS);
  ensureHeader_(surveys, ['survey_id', 'title', 'description', 'category', 'created_at']);

  var questions = ss.getSheetByName(SHEET_QUESTIONS) || ss.insertSheet(SHEET_QUESTIONS);
  ensureHeader_(questions, ['question_id', 'survey_id', 'type', 'label', 'options', 'required']);

  var responses = ss.getSheetByName(SHEET_RESPONSES) || ss.insertSheet(SHEET_RESPONSES);
  ensureHeader_(responses, [
    'response_id',
    'survey_id',
    'survey_title',
    'submitted_at',
    'device_id',
    'status',
    'answers_json'
  ]);
}

function seedSampleSurveys() {
  setupSheets();
  var ss = SpreadsheetApp.getActive();
  var surveys = ss.getSheetByName(SHEET_SURVEYS);
  var questions = ss.getSheetByName(SHEET_QUESTIONS);

  if (surveys.getLastRow() === 1) {
    surveys.appendRow(['facility-001', 'Khảo sát cơ sở vật chất VKU', 'Điều tra phòng học và thiết bị', 'Cơ sở vật chất', new Date().toISOString()]);
    surveys.appendRow(['student-001', 'Khảo sát ý kiến sinh viên', 'Thu thập ý kiến học tập', 'Xã hội học', new Date().toISOString()]);
  }

  if (questions.getLastRow() === 1) {
    questions.appendRow(['q1', 'facility-001', 'text', 'Tên địa điểm', '', 'true']);
    questions.appendRow(['q3', 'facility-001', 'radio', 'Tình trạng tổng thể', 'Tốt|Bình thường|Hư hỏng|Nguy hiểm', 'true']);
  }
}

function readSurveys_() {
  setupSheets();
  var ss = SpreadsheetApp.getActive();
  var surveyRows = values_(ss.getSheetByName(SHEET_SURVEYS));
  var questionRows = values_(ss.getSheetByName(SHEET_QUESTIONS));

  if (!surveyRows.length) return [];

  return surveyRows.map(function (row) {
    var id = String(row[0]);
    var qs = questionRows
      .filter(function (q) { return String(q[1]) === id; })
      .map(function (q) {
        return {
          id: String(q[0]),
          type: String(q[2] || 'text'),
          label: String(q[3] || ''),
          options: q[4] ? String(q[4]).split('|') : [],
          required: String(q[5]) === 'true'
        };
      });

    return {
      id: id,
      title: String(row[1] || id),
      description: String(row[2] || ''),
      category: String(row[3] || ''),
      questions: qs,
      estimatedMinutes: 4
    };
  }).filter(function (s) { return s.questions.length > 0; });
}

function findResponseRow_(sheet, responseId) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === responseId) return i + 2;
  }
  return 0;
}

/**
 * Giữ answers_json làm nguồn sự thật, đồng thời bung từng câu thành cột
 * để mở Sheet là đọc được khi demo.
 */
function flattenAnswers_(sheet, answers) {
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var lastRow = sheet.getLastRow();
  Object.keys(answers).forEach(function (key) {
    var col = header.indexOf(key) + 1;
    if (col === 0) {
      col = header.length + 1;
      sheet.getRange(1, col).setValue(key);
      header.push(key);
    }
    var value = answers[key];
    if (Object.prototype.toString.call(value) === '[object Array]') {
      value = value.join(', ');
    }
    sheet.getRange(lastRow, col).setValue(value);
  });
}

function ensureHeader_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    return;
  }
  var current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (!current[0]) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function values_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
