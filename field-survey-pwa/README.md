# VKU Field Survey PWA

Một mã nguồn **vừa website vừa ứng dụng** (PWA). Khảo sát thực địa offline-first: lưu IndexedDB trên thiết bị, có mạng thì đồng bộ Google Sheets.

Môn phát triển ứng dụng đa nền tảng / đa phương tiện — Week 3 Progressive Web Apps.

---

# HƯỚNG DẪN NHANH

Làm theo thứ tự: chạy local → (tuỳ chọn) Google Sheets → deploy HTTPS → cài app trên điện thoại.

---

## A. Chạy trên máy tính (web)

Không mở file bằng `file://`. Phải chạy HTTP server.

**Cách 1 — Python**

```powershell
cd d:\mob\field-survey-pwa
python -m http.server 4173
```

**Cách 2 — Node**

```powershell
cd d:\mob\field-survey-pwa
npx --yes serve -l 4173
```

Mở trình duyệt: [http://localhost:4173](http://localhost:4173)

Header hiện nhãn **Web**. Có thể khảo sát ngay, kể cả khi chưa cấu hình Google Sheets (dữ liệu nằm trên máy).

---

## B. Cài đặt trong app ở đâu?

Nút **⚙ Cài đặt** nằm **góc trên bên phải** (cạnh Online/Offline).

Hoặc:

- Trang chủ → chữ **Cài đặt**
- Địa chỉ: `http://localhost:4173/#/settings`

Tại đây dán URL Google Apps Script vào ô **Google Apps Script URL** → **Lưu cấu hình**.

Mỗi thiết bị lưu riêng. Máy tính đã dán URL **không** tự hiện trên điện thoại — phải dán lại trên điện thoại.

---

## C. Nối Google Sheets (để đồng bộ kết quả)

Chi tiết: `apps-script/README.md`. Tóm tắt:

1. Tạo Google Sheet tên `FieldSurveyDB`.
2. `Tiện ích mở rộng` → `Apps Script`.
3. Dán hết file `apps-script/Code.gs` → Lưu.
4. Chọn hàm `setupSheets` → **Chạy** (cấp quyền Google lần đầu).
5. `Triển khai` → `New deployment` → loại **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy URL `https://script.google.com/macros/s/...../exec`
7. Mở PWA → **⚙ Cài đặt** → dán URL → **Lưu cấu hình**

Mở URL đó trên trình duyệt phải thấy JSON `{"ok":true,"service":"Field Survey API",...}`.

Chưa có URL thì vẫn làm khảo sát được; bản ghi ở trạng thái **Chờ đồng bộ**.

---

## D. Chạy trên điện thoại (cùng Wi‑Fi)

1. Máy tính và điện thoại **chung Wi‑Fi** (điện thoại không dùng 4G).
2. Máy tính chạy:

```powershell
cd d:\mob\field-survey-pwa
python -m http.server 4173 --bind 0.0.0.0
```

3. Lấy IP máy: PowerShell `ipconfig` → **IPv4 Address** (ví dụ `172.26.17.25`).
4. Điện thoại mở: `http://172.26.17.25:4173`

Nếu không vào được: cho phép Python qua Firewall, tắt VPN.

**Hạn chế:** `http://IP` thường **không cài được ra màn hình chính** và offline/refresh có thể hỏng. Muốn thành app → mục E + F (cần HTTPS).

---

## E. Deploy lên Cloudflare (HTTPS)

Cần tài khoản [Cloudflare](https://dash.cloudflare.com/sign-up) (miễn phí).

Mở **terminal của bạn** (không để lệnh login hết hạn):

```powershell
cd d:\mob\field-survey-pwa
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
fnm use 20.18.0
npm install
npx wrangler login
```

Khi trình duyệt hiện **Wrangler wants to access your account** → bấm **Authorize** ngay. Terminal phải báo đã login thành công.

Rồi publish:

```powershell
npm run deploy
```

Hoặc một lệnh: `.\scripts\deploy.ps1`

URL production:

`https://vku-field-survey-pwa.pages.dev`

Lần sau chỉ cần `npm run deploy`.

Tự deploy khi push GitHub `main`: thêm secret `CLOUDFLARE_API_TOKEN` và `CLOUDFLARE_ACCOUNT_ID`. File: `.github/workflows/cloudflare-pages.yml`.

Cách khác không cần Wrangler: kéo thư mục `field-survey-pwa` vào [Netlify Drop](https://app.netlify.com/drop).

---

## F. Cài như ứng dụng (Home Screen)

Phải mở bằng **HTTPS** (link Cloudflare/Netlify), không dùng `http://IP`.

**Android — Chrome**

1. Mở `https://vku-field-survey-pwa.pages.dev`
2. Trên trang chủ bấm **Cài lên màn hình chính**, hoặc menu `⋮` → **Cài đặt ứng dụng**
3. Mở icon **Field Survey**

**iPhone — Safari** (không dùng Chrome)

1. Mở link HTTPS
2. Nút **Chia sẻ** → **Thêm vào Màn hình chính** → Thêm
3. Mở icon

Header lúc này hiện nhãn **App**. Vào **⚙ Cài đặt** trên **điện thoại** và dán lại URL Apps Script.

---

## G. Demo offline (thuyết trình)

Làm trên bản HTTPS đã mở **một lần khi còn mạng** (để Service Worker kịp cache).

1. Online — mở app.
2. Tắt mạng (máy bay hoặc DevTools → Offline).
3. Refresh — app vẫn mở.
4. Điền khảo sát → Gửi.
5. Chrome DevTools → Application → IndexedDB → `FieldSurveyDB` → `responses` → `status = pending`.
6. Bật mạng — tự đồng bộ (hoặc tab **Đồng bộ**).
7. Mở Google Sheet — có đúng 1 dòng / 1 `response_id`.

---

## H. Điều hướng trong app

| Chỗ | Làm gì |
| --- | --- |
| **Home** | Trạng thái mạng, danh sách khảo sát, chờ sync |
| **Khảo sát** | Tất cả cuộc khảo sát |
| **Lịch sử** | Bài đã gửi trên thiết bị này |
| **Đồng bộ** | Số pending / synced / lỗi, nút đồng bộ ngay |
| **⚙ Cài đặt** | URL Apps Script, token, cài app, xoá lịch sử đã sync |

---

# TÀI LIỆU ĐỒ ÁN

## 1. Project introduction

Nhân viên điều tra thường làm việc ở nơi sóng yếu. App chỉ online dễ mất dữ liệu.

Field Survey PWA:

1. Luôn ghi câu trả lời vào IndexedDB.
2. Online → đồng bộ Google Apps Script → Google Sheets.
3. Offline → `status = pending`.
4. Có mạng lại → Sync Manager gửi bản ghi còn thiếu.
5. Server chống trùng theo `responseId`.

## 2. Features

- Khảo sát JSON (text, textarea, number, radio, checkbox, select, date, time, rating, có/không).
- Validate trên form, không `alert()`.
- Offline-first + hàng đợi sync.
- Trạng thái: pending / syncing / synced / failed.
- Lịch sử từ IndexedDB.
- Website responsive + cài Home Screen.
- Manifest, Service Worker, Cache API, Background Sync (có fallback).

## 3. Technologies

| Lớp | Công nghệ |
| --- | --- |
| UI | HTML5, CSS3, JavaScript ES6 modules |
| PWA | Manifest, Service Worker, Cache API |
| Local | IndexedDB `FieldSurveyDB` |
| Sync | Background Sync + `window.online` |
| Backend | Google Apps Script Web App |
| Database | Google Sheets |
| Hosting | Cloudflare Pages (HTTPS) |

Không dùng MySQL. Không dùng framework nặng.

## 4. Architecture

```text
User (Web trình duyệt  hoặc  App Home Screen)
    → Survey UI (HTML/CSS/JS)
    → IndexedDB (surveys, responses, syncQueue, settings)
         │
    Internet?
    /         \
  No           Yes
  chờ sync     Sync Manager → Google Apps Script → Google Sheets
```

## 5. Offline-first mechanism

```text
Form submit
  → lưu IndexedDB (luôn luôn)
  → navigator.onLine?
        Có  → POST Apps Script → status=synced
        Không → status=pending → Background Sync
  → online / sync
        → pending+failed → POST
        → chỉ synced khi API trả ok
```

## 6. IndexedDB

| Store | Key | Mục đích |
| --- | --- | --- |
| `surveys` | `id` | Cache định nghĩa khảo sát |
| `responses` | `id` | Câu trả lời + trạng thái sync |
| `syncQueue` | `id` | Hàng đợi `responseId` |
| `settings` | `key` | `deviceId`, `apiUrl`, `syncToken` |

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

## 7. Service Worker

Vòng đời: Install → Activate → Fetch.

| Tài nguyên | Strategy | Lý do |
| --- | --- | --- |
| HTML, CSS, JS, icons | Cache-First | App Shell mở khi offline |
| `data/surveys.json` | Network-First | Ưu tiên khảo sát mới |
| POST Apps Script | Network-Only | Không cache giao dịch |

## 8. Sync mechanism

1. Đọc `pending` / `failed` / `syncing`.
2. POST qua `api.js`.
3. Thành công → `synced`.
4. Lỗi → giữ local, retry.
5. Background Sync `sync-responses` hoặc `window.online`.

## 9. Google Sheets

- **Surveys** — `survey_id | title | description | category | created_at`
- **Questions** — `question_id | survey_id | type | label | options | required`
- **Responses** — `response_id | survey_id | survey_title | submitted_at | device_id | status | answers_json | q1 | q2 | ...`

`doPost` tìm `response_id` đã có → `{ duplicate: true }`, không thêm dòng.

Client gửi `Content-Type: text/plain` để tránh CORS preflight.

## 10–12. Cài đặt / cấu hình / chạy local

Xem mục **A, B, C** ở đầu file.

## 13. Deployment

Xem mục **E**.

## 14. Offline testing

Xem mục **G**.

## 15. Project structure

```text
field-survey-pwa/
├── index.html
├── manifest.json
├── service-worker.js
├── wrangler.toml
├── package.json
├── css/
├── js/
├── data/surveys.json
├── icons/
├── apps-script/Code.gs
├── scripts/build-pages.mjs
├── scripts/deploy.ps1
├── .github/workflows/cloudflare-pages.yml
├── docs/
│   ├── technical-report.md
│   ├── submission-checklist.md
│   └── run-on-phone.md
└── README.md
```

## 16. Screenshots (chụp trước khi nộp)

Đặt vào `docs/screenshots/`: home online/offline, form, success offline, IndexedDB, Google Sheets, app đã cài.

## 17. Future improvements

Ảnh hiện trường, GPS, admin tạo khảo sát trên Sheets, API có đăng nhập.

---

## Bảo mật

Web App “Anyone” = ai có URL cũng POST được. Token trên frontend không phải bí mật. Không thu thập dữ liệu nhạy cảm.

---

## File hướng dẫn khác

| File | Nội dung |
| --- | --- |
| `apps-script/README.md` | Tạo Sheet + deploy Apps Script |
| `docs/run-on-phone.md` | Chi tiết chạy / cài trên điện thoại |
| `docs/technical-report.md` | Báo cáo 2–4 trang |
| `docs/submission-checklist.md` | Checklist trước khi nộp |

Đồ án học tập — VKU.
