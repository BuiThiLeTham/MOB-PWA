# Checklist trước khi nộp bài

Dùng danh sách này để tự kiểm tra trước buổi demo / nộp zip.

## Mã nguồn & cấu trúc

- [ ] Đủ thư mục: `css/`, `js/`, `data/`, `icons/`, `apps-script/`, `docs/`
- [ ] Có `index.html`, `manifest.json`, `service-worker.js`
- [ ] Logic tách module, không nhét hết vào một file
- [ ] `GAS_WEB_APP_URL` chỉ nằm ở `js/config.js` hoặc Settings
- [ ] Không commit secret / dữ liệu cá nhân

## PWA

- [ ] Manifest: name, short_name, start_url, display=standalone, icons, theme_color
- [ ] Icon 192 và 512 (PNG) mở được
- [ ] Service Worker đăng ký thành công trên localhost/HTTPS
- [ ] DevTools → Application → Cache Storage có App Shell
- [ ] Lighthouse PWA không fail các tiêu chí installable cơ bản

## Offline-first (bắt buộc)

- [ ] Tắt mạng, refresh, app vẫn mở
- [ ] Submit offline → IndexedDB `responses.status = pending`
- [ ] Đóng tab, mở lại khi vẫn offline → lịch sử còn
- [ ] Bật mạng → tự sync (hoặc nút Đồng bộ ngay)
- [ ] Google Sheet có đúng 1 dòng / 1 `response_id`

## Form & UI

- [ ] Ít nhất 1 khảo sát demo đủ loại câu hỏi
- [ ] Validate hiện trong form, không dùng `alert()`
- [ ] Có loading / empty / error state
- [ ] Chỉ báo Online / Offline trên header
- [ ] Mobile: nút gửi lớn, không bảng rộng
- [ ] 4 tab: Home, Khảo sát, Lịch sử, Đồng bộ

## Google Sheets

- [ ] Đã chạy `setupSheets`
- [ ] Web App deploy: Execute as Me, Anyone
- [ ] URL dán vào app và thử 1 submit online
- [ ] Retry cùng id không tạo dòng thứ hai

## Báo cáo & README

- [ ] README đủ 17 mục
- [ ] `docs/technical-report.md` 2–4 trang, có architecture + bảng test
- [ ] Chụp screenshot demo (home offline, IndexedDB, Sheets)
- [ ] Ghi rõ hạn chế bảo mật của Apps Script

## Demo thuyết trình (khoảng 3 phút)

1. Mở app online, chỉ header xanh Online.
2. DevTools Offline hoặc Airplane mode.
3. Refresh — app còn.
4. Gửi 1 khảo sát — toast / trang thành công.
5. Application → IndexedDB → `pending`.
6. Online lại — Đồng bộ.
7. Mở Google Sheets — thấy dữ liệu.

## Nộp file

- [ ] Nén `field-survey-pwa/` (không gồm `node_modules` nếu có)
- [ ] Tên file theo quy định lớp
- [ ] Link Sheet chỉ xem (viewer) nếu giảng viên cần kiểm
- [ ] Không đưa Sheet chứa dữ liệu thật của người khác
