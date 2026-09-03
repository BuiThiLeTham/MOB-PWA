# VKU Field Survey PWA

Offline-first Progressive Web App cho điều tra / khảo sát thực địa. **Một mã nguồn vừa là website vừa là ứng dụng** (mở trên trình duyệt hoặc cài ra màn hình chính). Người dùng điền form khi không có Internet; dữ liệu lưu IndexedDB rồi đồng bộ Google Sheets khi có mạng.

Dự án bám sát môn phát triển ứng dụng đa nền tảng / đa phương tiện (Week 3 — Progressive Web Apps, mini-project **VKU Field Survey PWA**).

---

## 1. Project introduction

Nhân viên điều tra thường làm việc ở nơi sóng yếu hoặc không có mạng. Ứng dụng chỉ hoạt động online dễ làm mất dữ liệu hoặc không gửi được form.

Field Survey PWA giải quyết bằng nguyên tắc **offline-first**:

1. Luôn ghi câu trả lời vào IndexedDB trên thiết bị.
2. Nếu online, thử đồng bộ ngay lên Google Apps Script → Google Sheets.
3. Nếu offline, `status = pending` và xếp hàng đợi.
4. Khi có Internet (sự kiện `online` hoặc Background Sync), Sync Manager gửi các bản ghi còn thiếu.
5. Server chống trùng theo `responseId` nên retry an toàn.

---

## 2. Features

- Danh sách khảo sát động từ JSON (có thể lấy thêm từ Google Sheets).
- Form nhiều loại câu hỏi: text, textarea, number, radio, checkbox, select, date, time, rating, có/không.
- Validate trên giao diện, không dùng `alert()`.
- Offline-first submit + hàng đợi đồng bộ.
- Trạng thái từng bản ghi: pending / syncing / synced / failed.
- Trang lịch sử đọc từ IndexedDB.
- Chỉ báo Online / Offline luôn hiện.
- Chạy như **website** trên PC/tablet/phone (responsive).
- Cài như **ứng dụng** (Home Screen, `display: standalone`) từ cùng source.
- PWA: Manifest, Service Worker, Cache API, Background Sync (có fallback).

---

## 3. Technologies

| Lớp | Công nghệ |
| --- | --- |
| UI | HTML5, CSS3, JavaScript ES6 modules |
| PWA | Web App Manifest, Service Worker, Cache API |
| Local DB | IndexedDB (`FieldSurveyDB`) |
| Sync | Background Sync API + `window.online` fallback |
| Backend | Google Apps Script Web App |
| Database trung tâm | Google Sheets |
| Hosting | Bất kỳ HTTPS tĩnh (GitHub Pages, Netlify, Firebase, nginx) |

Không dùng MySQL cho kết quả khảo sát. Không dùng framework nặng.

---

## 4. Architecture

```text
User Mobile PWA
    → Survey UI (HTML/CSS/JS)
    → IndexedDB (surveys, responses, syncQueue, settings)
         │
    Internet?
    /         \
  No           Yes
  chờ sync     Sync Manager → Google Apps Script → Google Sheets
```

Luồng submit **không** ghi thẳng lên Sheets. Local là nguồn sự thật trên thiết bị cho đến khi server xác nhận.

---

## 5. Offline-first mechanism

```text
Form submit
  → lưu IndexedDB (luôn luôn)
  → navigator.onLine?
        Có  → POST Apps Script → status=synced
        Không → status=pending → đăng ký Background Sync
  → online / sync event
        → lấy pending+failed
        → POST lần lượt
        → chỉ đổi synced khi API trả ok
```

Reload trang hoặc đóng trình duyệt **không mất** dữ liệu vì IndexedDB là lưu trữ bền.

---

## 6. IndexedDB

Database: `FieldSurveyDB`

| Store | Key | Mục đích |
| --- | --- | --- |
| `surveys` | `id` | Cache định nghĩa khảo sát |
| `responses` | `id` | Câu trả lời + trạng thái sync |
| `syncQueue` | `id` | Hàng đợi tham chiếu `responseId` |
| `settings` | `key` | `deviceId`, `apiUrl`, `syncToken` |

Response:

```json
{
  "id": "uuid",
  "surveyId": "facility-001",
  "submittedAt": "2026-09-03T08:30:00.000Z",
  "status": "pending",
  "answers": { "q1": "Phòng A101" },
  "syncAttempts": 0
}
```

---

## 7. Service Worker

File `service-worker.js` triển khai đủ vòng đời Install → Activate → Fetch.

| Loại tài nguyên | Strategy | Lý do |
| --- | --- | --- |
| HTML, CSS, JS, icons, manifest | Cache-First | App Shell phải mở được khi offline / refresh khi mất mạng |
| `data/surveys.json` | Network-First | Ưu tiên khảo sát mới; fallback cache khi mất mạng |
| POST Google Apps Script | Network-Only (không intercept) | Không được cache giao dịch đồng bộ |

---

## 8. Sync mechanism

1. `sync.js` đọc record `pending` / `failed` / `syncing`.
2. Đổi `syncing`, gọi `api.js` → `fetch` POST.
3. Thành công: `synced`, xóa khỏi `syncQueue`.
4. Thất bại: giữ nguyên local, `pending` hoặc `failed`, retry sau.
5. Nếu trình duyệt hỗ trợ Background Sync: `registration.sync.register('sync-responses')`.
6. Fallback: `window.addEventListener('online', ...)`.

---

## 9. Google Sheets integration

Ba sheet:

**Surveys** — `survey_id | title | description | category | created_at`

**Questions** — `question_id | survey_id | type | label | options | required`

**Responses** — `response_id | survey_id | survey_title | submitted_at | device_id | status | answers_json | q1 | q2 | ...`

`answers_json` là nguồn sự thật linh hoạt cho nhiều loại khảo sát. Apps Script đồng thời bung từng câu thành cột để dễ demo / lọc trên Sheets.

Chống trùng: `doPost` tìm `response_id` đã có thì trả `{ ok: true, duplicate: true }` và **không** `appendRow`.

---

## 10. Installation

Clone hoặc copy thư mục `field-survey-pwa/`. Không cần `npm install` cho runtime (vanilla JS).

Cần trình duyệt hiện đại (Chrome / Edge / Firefox / Safari) và môi trường **localhost hoặc HTTPS** để Service Worker chạy.

---

## 11. Configuration

Mở `js/config.js`, hoặc trong app bấm **⚙ Cài đặt** (góc trên bên phải) / Home → **Cài đặt** / địa chỉ `#/settings`:

```js
GAS_WEB_APP_URL: 'https://script.google.com/macros/s/XXXX/exec',
SYNC_TOKEN: '' // trùng Script Property nếu bạn bật
```

URL chỉ nên nằm ở config / Settings, không hard-code rải trong nhiều file.

---

## 12. Running locally

Trong thư mục `field-survey-pwa`:

```bash
# Cách 1 — Node
npx --yes serve -l 4173

# Cách 2 — Python
python -m http.server 4173
```

Mở http://localhost:4173

Service Worker **không** hoạt động nếu mở file bằng `file://`.

**Chạy trên điện thoại:** xem `docs/run-on-phone.md`. Tóm tắt: cùng Wi‑Fi thì mở `http://<IPv4-máy-tính>:4173`; muốn cài Home Screen và demo offline thì phải dùng HTTPS (Netlify Drop hoặc tunnel).

---

## 13. Deployment (Cloudflare Pages)

Đã cấu hình sẵn. Trên máy (cần tài khoản Cloudflare):

```powershell
cd field-survey-pwa
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
fnm use 20.18.0
npm install
npx wrangler login
npm run deploy
```

`npm run deploy` đóng gói `dist/` rồi `wrangler pages deploy`. URL production dạng:

`https://vku-field-survey-pwa.pages.dev`

CI tự deploy khi push `main`: thêm secret GitHub `CLOUDFLARE_API_TOKEN` và `CLOUDFLARE_ACCOUNT_ID`. Workflow: `.github/workflows/cloudflare-pages.yml`.

Host tĩnh khác (Netlify Drop, GitHub Pages, nginx + TLS) vẫn dùng được vì `start_url` là đường dẫn tương đối. Sau khi có HTTPS, mở trên điện thoại → Add to Home Screen. Dán URL Apps Script trong Cài đặt trên thiết bị demo.

---

## 14. Offline testing (flow demo chính)

1. Mở app khi **Online**.
2. Tắt Internet (Airplane mode hoặc DevTools → Network → Offline).
3. Refresh: app **vẫn mở** nhờ App Shell cache.
4. Chọn khảo sát, điền form, Gửi.
5. Thấy “Đã lưu khảo sát trên thiết bị”, DevTools → Application → IndexedDB → `responses` → `status = pending`.
6. Bật Internet.
7. App tự sync (toast “Đang đồng bộ…” / “Đồng bộ thành công”).
8. Mở Google Sheet: có dòng mới, `response_id` khớp.

---

## 15. Project structure

```text
field-survey-pwa/
├── index.html
├── manifest.json
├── service-worker.js
├── css/
│   ├── style.css
│   └── responsive.css
├── js/
│   ├── app.js
│   ├── router.js
│   ├── survey.js
│   ├── form.js
│   ├── db.js
│   ├── sync.js
│   ├── api.js
│   ├── ui.js
│   └── config.js
├── data/
│   └── surveys.json
├── icons/
├── apps-script/
│   └── Code.gs
├── README.md
└── docs/
    ├── technical-report.md
    └── submission-checklist.md
```

---

## 16. Screenshots placeholder

Thêm ảnh chụp khi demo trước khi nộp:

- `docs/screenshots/home-online.png`
- `docs/screenshots/home-offline.png`
- `docs/screenshots/form.png`
- `docs/screenshots/success-offline.png`
- `docs/screenshots/indexeddb.png`
- `docs/screenshots/sheets.png`
- `docs/screenshots/installed-pwa.png`

---

## 17. Future improvements

- Đăng nhập giảng viên / điều tra viên.
- Ảnh hiện trường (lưu Blob trong IndexedDB, sync Drive).
- GPS / bản đồ vị trí khảo sát.
- Admin UI tạo khảo sát trên Sheets rồi PWA Network-First kéo về.
- Conflict resolution khi sửa bản ghi đã sync.
- Thay Sheets bằng API có auth thật khi đưa vào production.

---

## Hướng dẫn tạo Google Sheet + Apps Script

1. Tạo Google Sheet trống, đặt tên `FieldSurveyDB`.
2. `Extensions` → `Apps Script`.
3. Dán `apps-script/Code.gs`, lưu.
4. Chạy hàm `setupSheets` (Run) để tạo header. Cấp quyền cho tài khoản Google của bạn.
5. (Tuỳ chọn) `Project Settings` → Script properties → thêm `SYNC_TOKEN`.
6. `Deploy` → `New deployment` → loại **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Copy URL dạng `https://script.google.com/macros/s/<ID>/exec`.
8. Dán vào ô **Google Apps Script URL** trong trang Cài đặt (nút **⚙ Cài đặt** góc trên phải) hoặc vào `js/config.js`.

Client gửi `Content-Type: text/plain` để tránh CORS preflight — đây là cách ổn định với Apps Script.

---

## Security notes

Google Apps Script Web App “Anyone” nghĩa là **ai có URL cũng POST được**. Token trên frontend chỉ là lớp chặn nhẹ, không phải bí mật. Không thu thập thông tin nhạy cảm. Quyền Sheet nằm ở tài khoản Google của người deploy.

---

## License

Đồ án học tập — VKU.
