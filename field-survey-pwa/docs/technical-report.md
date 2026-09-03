# Báo cáo kỹ thuật — VKU Field Survey PWA

Môn: Phát triển ứng dụng đa nền tảng / đa phương tiện  
Đề tài: Offline-First Field Survey Progressive Web App (vừa website vừa ứng dụng)

---

## 1. Introduction

Điều tra thực địa (cơ sở vật chất, môi trường, hạ tầng, ý kiến sinh viên) thường diễn ra ở nơi mạng di động yếu hoặc mất hoàn toàn. Nếu ứng dụng chỉ gửi form khi online, người dùng không làm việc được hoặc dữ liệu bị mất khi submit thất bại.

Giải pháp của đồ án là **một Progressive Web App**: cùng một mã nguồn HTML/CSS/JS chạy được theo hai hình thức.

- **Web:** mở URL trên Chrome, Edge, Safari (máy tính hoặc điện thoại) như website thông thường.
- **App:** cài ra Home Screen (`display: standalone`), mở từ icon, không thanh địa chỉ — trải nghiệm gần ứng dụng gốc.

Không viết hai project (web riêng + Android/iOS riêng). Đây đúng hướng đa nền tảng của môn học: một codebase, nhiều bề mặt sử dụng. PWA vẫn offline-first: lưu IndexedDB, đồng bộ Google Sheets khi có mạng.

---

## 2. Objectives

- Cho phép thực hiện khảo sát trên mobile bằng giao diện lớn, dễ chạm.
- Hoạt động offline-first: App Shell + dữ liệu khảo sát + hàng đợi submit.
- Lưu cấu trúc dữ liệu bằng IndexedDB, không phụ thuộc MySQL.
- Tự động đồng bộ khi có mạng (Background Sync hoặc sự kiện `online`).
- Dùng Google Sheets làm database trung tâm để giảng viên xem kết quả nhanh.
- Đáp ứng tiêu chí PWA: Manifest, Service Worker, Cache API, HTTPS, installable.
- Cùng lúc là website (responsive PC/tablet/phone) và ứng dụng cài được.

---

## 3. System Architecture

```text
┌─────────────────────┐
│  User Mobile PWA    │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Survey UI (HTML/JS) │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ IndexedDB           │
│ surveys / responses │
│ syncQueue / settings│
└──────────┬──────────┘
      Internet?
     /         \
   No           Yes
   chờ     Sync Manager
               ▼
        Apps Script API
               ▼
         Google Sheets
```

**Schema Sheets (lựa chọn hybrid):**

- `Surveys` + `Questions`: quản lý nhiều cuộc khảo sát, không hard-code một form.
- `Responses.answers_json`: một cột JSON — linh hoạt khi thêm loại câu hỏi / khảo sát mới.
- Cột phụ `q1`, `q2`, … do Apps Script tự tạo: dễ đọc khi thuyết trình và lọc trên Sheet.

Cách này hơn “mỗi câu một cột cố định” vì project có nhiều chủ đề khảo sát; hơn “chỉ JSON” vì demo trên Sheets vẫn nhìn được từng ô.

IndexedDB song song trên thiết bị: `FieldSurveyDB` với bốn object store đúng yêu cầu môn học.

---

## 4. PWA Implementation

**Web App Manifest.** `manifest.json` khai báo `name`, `short_name`, `start_url`, `display: standalone`, `theme_color`, `background_color` và bộ icon 192/512 (any + maskable). Nhờ đó Chrome/Edge cho phép Add to Home Screen.

**Service Worker lifecycle.**

1. `install`: `cache.addAll(APP_SHELL)` — precache HTML, CSS, JS, icons, `surveys.json`.
2. `activate`: xóa cache tên cũ, `clients.claim()`.
3. `fetch`: phân nhánh strategy (mục dưới).

**Cache API strategies.**

| Strategy | Áp dụng | Lý do chọn |
| --- | --- | --- |
| Cache-First | App Shell | Refresh khi offline vẫn ra UI; tài nguyên ít đổi |
| Network-First | `surveys.json`, `?action=surveys` | Cần khảo sát mới khi online; offline dùng bản đã cache |
| Network-Only | POST Apps Script | Giao dịch không được phục vụ từ cache (tránh “tưởng đã sync”) |

**IndexedDB.** Mọi submit đều `put` vào `responses` trước khi gọi mạng. Reload / đóng app không mất hàng đợi. `deviceId` sinh một lần, lưu `settings`.

**Background Sync.** Sau submit, app gọi `registration.sync.register('sync-responses')` nếu API tồn tại. Service Worker nhận `sync` rồi `postMessage` cho trang chạy Sync Manager (cùng logic, cùng chống trùng). Trình duyệt không hỗ trợ thì `window.addEventListener('online')` vẫn đồng bộ.

---

## 5. Offline Workflow

```text
User → Form validate → IndexedDB (status=pending)
     → Offline: thông báo “Đã lưu trên thiết bị”
     → Online restored → Sync Manager
     → POST Apps Script (text/plain, tránh CORS preflight)
     → Ghi Sheets, idempotent theo responseId
     → status=synced
```

Nguyên tắc an toàn: **không xóa local trước khi server trả `{ ok: true }`**. Gửi lại cùng `responseId` không nhân bản dòng.

---

## 6. Testing

| Test | Kết quả mong đợi |
| --- | --- |
| Online submit | Ghi local rồi sync thành công, `status=synced` |
| Offline submit | IndexedDB `pending`, UI “Đã lưu trên thiết bị” |
| Reload khi offline | App Shell vẫn mở, lịch sử còn đủ bản ghi |
| Online trở lại | Tự sync, toast thành công |
| Sync failed (URL sai) | `pending`/`failed`, dữ liệu không bị xóa |
| Gửi trùng `responseId` | Apps Script `{ duplicate: true }`, một dòng |
| Install PWA | Manifest hợp lệ, icon, standalone |
| Validate form | Lỗi inline, không `alert()` |

Quy trình demo thuyết trình: Online → tắt mạng → refresh → điền form → submit → bật mạng → mở Sheets thấy dòng mới.

---

## 7. Conclusion

Đồ án chứng minh PWA đủ sức làm ứng dụng hiện trường: cài như app, chạy không mạng, lưu dữ liệu có cấu trúc, đồng bộ đáng tin khi có Internet. Google Sheets giúp phần backend nhẹ, phù hợp bài cuối kỳ, đồng thời bộc lộ giới hạn bảo mật (URL Web App công khai, không có auth người dùng thật).

Hướng phát triển: ảnh + GPS hiện trường, admin tạo khảo sát trên Sheets, và API có xác thực nếu triển khai thật.

---

*Tài liệu kèm: README.md (cài đặt / deploy / test), apps-script/Code.gs, docs/submission-checklist.md.*
