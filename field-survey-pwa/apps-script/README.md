# Google Sheet + Apps Script

## 1. Tạo spreadsheet

1. Vào [Google Sheets](https://sheets.google.com) → Blank spreadsheet.
2. Đổi tên thành `FieldSurveyDB`.
3. `Extensions` → `Apps Script`.
4. Xóa code mặc định, dán toàn bộ `Code.gs`.
5. Lưu project (ví dụ `FieldSurveyAPI`).

## 2. Tạo header

1. Trong Apps Script, chọn hàm `setupSheets`.
2. Run. Cấp quyền cho tài khoản Google của bạn lần đầu.
3. Quay lại Sheet: phải thấy 3 tab `Surveys`, `Questions`, `Responses` kèm hàng tiêu đề.

Tuỳ chọn: chạy `seedSampleSurveys` nếu muốn PWA lấy khảo sát từ Sheets (`?action=surveys`). Nếu các sheet khảo sát trống, PWA vẫn dùng `data/surveys.json`.

## 3. Token (tuỳ chọn)

`Project Settings` → `Script properties` → Add:

- Property: `SYNC_TOKEN`
- Value: một chuỗi bạn tự đặt 111105

Nhập cùng giá trị trong trang Cài đặt của PWA. Token **vẫn nằm trên client**, chỉ lọc request lang thang.

## 4. Deploy Web App

1. `Deploy` → `New deployment`.
2. Type: **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone**.
5. Deploy → copy URL `https://script.google.com/macros/s/.../exec`.
6. Mở PWA trên trình duyệt → bấm **⚙ Cài đặt** ở góc trên bên phải
   (hoặc vào Home → chữ **Cài đặt**, hoặc mở trực tiếp `#/settings`).
   Dán URL vào ô **Google Apps Script URL** → **Lưu cấu hình**.

Mỗi lần sửa `Code.gs`, tạo **New deployment** hoặc `Manage deployments` → Edit → New version. URL cũ có thể không nhận code mới.

## 5. Kiểm tra API

Mở URL trên trình duyệt: phải thấy JSON

```json
{"ok":true,"service":"Field Survey API","version":"1.0.0"}
```

## 6. Vì sao Content-Type text/plain?

PWA gửi `text/plain;charset=utf-8` để trình duyệt **không** preflight CORS. Apps Script vẫn đọc `e.postData.contents` rồi `JSON.parse`. Đây là cách ổn định cho đồ án sinh viên.

## 7. Chống trùng

`doPost` tìm `response_id` ở cột A. Nếu đã có → `{ ok: true, duplicate: true }`, không `appendRow`. Client vẫn được phép đánh dấu `synced`.
