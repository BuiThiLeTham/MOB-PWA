/**
 * Cấu hình tập trung của Field Survey PWA.
 * Google Apps Script URL chỉ được khai báo ở đây (và có thể ghi đè trong Settings).
 * Không hard-code URL API ở các module khác.
 */
export const APP_CONFIG = {
  APP_NAME: 'Field Survey',
  APP_FULL_NAME: 'VKU Field Survey PWA',
  VERSION: '1.0.0',
  DB_NAME: 'FieldSurveyDB',
  DB_VERSION: 1,

  /**
   * Dán URL Web App sau khi Deploy Google Apps Script.
   * Ví dụ: https://script.google.com/macros/s/XXXX/exec
   */
  GAS_WEB_APP_URL: '',

  /**
   * Token tùy chọn — phải trùng với Script Property SYNC_TOKEN bên Apps Script.
   * Không phải cơ chế bảo mật thật (token vẫn nằm trên client).
   */
  SYNC_TOKEN: '',

  SYNC_TAG: 'sync-responses',
  MAX_SYNC_ATTEMPTS: 8,
  SURVEYS_PATH: './data/surveys.json',
};

export const RESPONSE_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  FAILED: 'failed',
};
