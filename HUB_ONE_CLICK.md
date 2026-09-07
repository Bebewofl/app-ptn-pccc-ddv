# HUB-PTN — Quy trình 1 nút

Mục tiêu: không dùng ZIP/CMD/Downloads để build và deploy HUB nữa.

## Bản hiện tại
- Production đang giữ nguyên bản ổn định hiện có cho tới khi Preview mới test đạt.
- Nguồn phát triển mới: branch `hub-v225-oneclick`.
- Candidate mới: **HUB V2.2.5**.
- Nền nghiệp vụ: V2.2.4 FIX2 (phản hồi R&D + audit + chat hai chiều PTN ↔ R&D), bỏ cơ chế khóa version bằng MutationObserver gây treo trang.

## Mỗi lần làm việc chỉ dùng GitHub → Actions

### 0. Kiểm tra bản mới
Chạy workflow:
**HUB - 0. Kiểm tra bản mới**

Không cần Firebase. Không ảnh hưởng Production.

### 1. Test Preview
Chạy workflow:
**HUB - 1. Chạy Preview**

Workflow tự:
- lấy đúng source mới nhất;
- build;
- kiểm tra cú pháp;
- tạo artifact truy vết;
- deploy Preview `hub-v225-candidate`.

### 2. Xuất Production
Chỉ chạy sau khi Preview test OK.
Workflow:
**HUB - 2. Xuất Production**

Nhập xác nhận: `XUAT BAN`

Trước khi nâng cấp lần đầu, workflow tự chụp và lưu snapshot V2.1.1 vào GitHub để có đường quay lại.

### 3. Quay lại V2.1.1
Workflow:
**HUB - 3. Quay lại V2.1.1**

Nhập xác nhận: `QUAY LAI V2.1.1`

Rollback này chỉ thay Hosting. Firestore Rules không bị workflow thay đổi.

## Cấu hình 1 lần duy nhất: FIREBASE_TOKEN
Nếu Preview báo thiếu `FIREBASE_TOKEN`:
1. Trên máy đã có Firebase CLI, mở Terminal/CMD và chạy `firebase login:ci`.
2. Đăng nhập đúng tài khoản Firebase quản lý project `app-ptn-pccc`.
3. Sao chép token được Firebase trả về.
4. GitHub repository → **Settings → Secrets and variables → Actions → New repository secret**.
5. Name: `FIREBASE_TOKEN`.
6. Value: dán token → Save.

Token là thông tin bí mật: không gửi token qua ChatGPT, email hoặc nhóm chat.

Sau bước này, các máy khác không cần Firebase CLI để deploy HUB; chỉ cần vào GitHub Actions và bấm workflow.
