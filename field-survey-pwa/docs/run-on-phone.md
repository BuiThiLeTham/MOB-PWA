# Chạy Field Survey PWA trên điện thoại

Có **2 cách**. Cách A nhanh để xem giao diện. Cách B mới đủ chuẩn PWA (cài Home Screen + offline).

---

## Cách A — Cùng Wi‑Fi với máy tính (nhanh)

Điện thoại và máy tính phải cùng một mạng Wi‑Fi. Đừng dùng 4G/5G trên điện thoại.

### 1. Chạy server trên máy tính

Trong thư mục `field-survey-pwa`:

```powershell
python -m http.server 4173 --bind 0.0.0.0
```

Giữ cửa sổ này mở.

### 2. Lấy IP máy tính

PowerShell:

```powershell
ipconfig
```

Tìm **IPv4 Address** của Wi‑Fi, ví dụ `172.26.17.25`.

### 3. Mở trên điện thoại

Trình duyệt điện thoại (Chrome hoặc Safari):

```text
http://172.26.17.25:4173
```

Thay bằng IP máy bạn.

### 4. Nếu không vào được

- Tắt VPN trên máy / điện thoại.
- Windows: cho phép Python qua Firewall (Private network), hoặc tạm tắt firewall để thử.
- Đổi cổng nếu 4173 bị chặn:

```powershell
python -m http.server 8080 --bind 0.0.0.0
```

Rồi mở `http://<IP>:8080`.

### Hạn chế cách A

Trình duyệt coi `http://IP-LAN` là **không an toàn**. Thường xảy ra:

- Giao diện vẫn dùng được, khảo sát / IndexedDB vẫn chạy.
- **Service Worker có thể không đăng ký** → refresh khi offline có thể trắng trang.
- **Không hiện nút Cài lên màn hình chính**.

Muốn demo offline + cài app: dùng Cách B.

---

## Cách B — Đưa lên HTTPS (nên dùng khi thuyết trình)

Service Worker và “Add to Home Screen” chỉ ổn định trên **HTTPS** (hoặc localhost).

### B1. Netlify Drop (không cần git)

1. Nén không cần. Mở [https://app.netlify.com/drop](https://app.netlify.com/drop) trên máy tính.
2. Kéo cả thư mục `field-survey-pwa` thả vào.
3. Được URL dạng `https://xxxxx.netlify.app`.
4. Mở URL đó trên điện thoại.

### B2. Đường hầm HTTPS từ máy local

Máy vẫn chạy `python -m http.server 4173`. Cài [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/), rồi:

```powershell
cloudflared tunnel --url http://localhost:4173
```

Copy URL `https://....trycloudflare.com` sang điện thoại.

### B3. GitHub Pages / Netlify / Cloudflare Pages

Upload project, bật HTTPS, mở link trên điện thoại. Xem thêm mục Deployment trong `README.md`.

---

## Cài lên màn hình chính

### Android (Chrome)

1. Mở URL **HTTPS** của app.
2. Menu `⋮` → **Cài đặt ứng dụng** / **Thêm vào màn hình chính**.
3. Mở icon Field Survey như app thường.

### iPhone (Safari)

1. Mở URL **HTTPS** bằng Safari (không dùng Chrome trên iOS cho bước này).
2. Nút **Chia sẻ** → **Thêm vào Màn hình chính**.
3. Đặt tên `Field Survey` → Thêm.

---

## Sau khi mở trên điện thoại

1. Vào **⚙ Cài đặt** (góc trên phải).
2. Dán URL Google Apps Script `https://script.google.com/macros/s/.../exec`.
3. Bấm **Lưu cấu hình**.
4. Làm 1 khảo sát online để kiểm tra Sheet.
5. Demo offline: bật **Chế độ máy bay** → refresh (cần đã mở app lúc còn mạng để SW kịp cache) → gửi form → tắt máy bay → đồng bộ.

Mỗi điện thoại có IndexedDB riêng. Dữ liệu trên máy tính không tự hiện trên điện thoại.

---

## Checklist khi demo bằng điện thoại

- [ ] Mở bằng Chrome (Android) hoặc Safari (iPhone)
- [ ] URL là `https://...` nếu cần cài app / offline
- [ ] Đã dán URL Apps Script trên **chính điện thoại đó**
- [ ] Đã mở app 1 lần khi còn mạng trước khi tắt mạng
- [ ] Sheet có quyền / Web App deploy “Anyone”
