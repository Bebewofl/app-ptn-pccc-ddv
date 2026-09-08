# Đối chiếu và hợp nhất V2.2.4/V2.2.5

Mốc bắt đầu `develop`: `5d2840f`, trùng `hub-v225-oneclick`.
Mốc V2.2.4 FIX2: `f5f4616` (`hub-v22-builder`), đã là tổ tiên của develop.
Không merge `main`: cây mã trên main là ứng dụng React/Vite khác với cây builder trên develop. Chỉ chuyển ý tưởng kiểm tra/Preview sang workflow dùng đúng commit develop.

## Đã hợp nhất

| Thành phần trước | Nguồn hiện tại | Xử lý |
|---|---|---|
| Hosting V2.1.1 | `src/app.js`, `src/index.html`, `src/assets` | Tách mã nền thành file có thể sửa trực tiếp; lưu bản chụp nguyên trạng kèm hash |
| `hub-v22.js` + phản hồi `hub-v223-rndfix.js` | `src/interdept.js` | Một nơi xử lý workflow, phản hồi, file/ảnh/link; gọi trực tiếp từ ứng dụng |
| `hub-v224-chat.js` | `src/chat.js` | Giữ collection chung `hub_interdept_chat`, thread VM/GENERAL, đọc lịch sử cũ từ comments |
| Versionfix/core bootstrap | `VERSION.json`, build-info sinh khi build | Không quét DOM hoặc MutationObserver để khóa nhãn phiên bản |
| Builder Downloads/mirror production | `scripts/build-hub.mjs` | Build offline từ src; không tự lấy nội dung website đang chạy |

Sửa audit tại truy vấn gốc: chỉ lọc `caseId`, sắp xếp thời gian ở client; bỏ cơ chế chờ lỗi index rồi sửa giao diện.
Tệp của VM mới được chuẩn bị trước và gắn vào mã do transaction cấp sau khi VM lưu thành công; bỏ đoán mã và chờ 300 ms.
Chat hủy listener khi rời trang/đăng xuất, loại callback cũ khi đổi thread, chặn gửi lặp trong lúc đang gửi; thread nhớ riêng theo UID.
Quyền tổng quan R&D dùng permission `rnd.tech.overview`, bỏ ngoại lệ tự cấp theo email. `canSeePrivateHandling` giữ kiểm tra theo phạm vi bộ phận như nền V2.1.1, không dùng quyền tổng quan để mở rộng.

## Chưa thể xác nhận

Ngày 08/09/2026, người dùng đã cung cấp Rules hiện hành. Nguyên bản nằm tại `rules/production-received-2026-09-08.rules`; bản sửa để kiểm thử nằm tại `rules/firestore.candidate.rules`. Không triển khai Rules. Xem [rà soát Rules](RULES-REVIEW.md).

Trước khi công nhận Preview đạt cần kiểm tra bằng emulator và hai tài khoản đúng vai trò trên môi trường test. Cần đối chiếu cả các trường nhạy cảm trong `hub_cases`: Firestore không tự che từng trường khi đã cho đọc document. Việc có các trường riêng tư trong dữ liệu thật chưa được kiểm tra.

Các bài test client dùng Firebase/DOM giả lập. Bộ `npm run test:rules` bổ sung kiểm thử Rules bằng Firestore Emulator, gồm hai client realtime độc lập. Các bài này không thay thế nghiệm thu bằng trình duyệt và tài khoản thực tế trên môi trường test.

Production được giữ nguyên. Không có workflow xuất Production hoặc Rules hoạt động trong develop. Các workflow cũ trên main chưa sửa theo yêu cầu giữ main an toàn; không chạy chúng để phát hành bản hợp nhất.
