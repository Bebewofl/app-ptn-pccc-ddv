# Rà soát Rules nhận ngày 08/09/2026

Nguồn: file người dùng dán từ Firebase trong phiên làm việc, chưa đối chiếu trực tiếp trạng thái server. Giữ nguyên bản tại `rules/production-received-2026-09-08.rules`. Mọi sửa đổi ở `rules/firestore.candidate.rules` là **candidate chưa triển khai**.

## Phát hiện và xử lý

| Phát hiện trong bản nhận | Thay đổi candidate |
|---|---|
| Không có match cho `hub_interdept_chat`; chỉ owner được truy cập nhờ wildcard | Thêm quyền đọc/gửi theo vai trò, tác giả và VM; tin append-only đối với người dùng thường |
| R&D có `rnd.tech.overview` vẫn không đọc được tổng quan | Cho R&D đang hoạt động, có unit RD và permission đọc case công khai; không đưa quyền này vào private notes |
| Quyền private notes dựa hoàn toàn vào phòng hiện đang nhận VM | Ghi chú mới có `unitCode`; bộ phận chỉ đọc ghi chú đúng bộ phận đang xử lý. Ghi chú cũ thiếu unitCode chỉ cấp quản lý trung tâm xem |
| Query chat cũ tải cả space rồi lọc VM ở UI | Query mới lọc `spaceKey` và `threadKey` ở Firestore; Rules kiểm tra quyền VM. Chỉ dùng điều kiện bằng, không orderBy |
| Người đọc case có thể gửi `department_response` dù không phải bộ phận xử lý | Kiểm tra trách nhiệm hiện tại; R&D cần thêm `rnd.response.manage` |
| Quyền update VM chưa bắt buộc active; changedKeys không chặn thêm/xóa trường | Bắt buộc active và dùng affectedKeys ở các thao tác chuyển cấp/tiếp nhận; receiver chỉ tiếp nhận/đang xử lý |

Không di chuyển, sửa hoặc gán đoán bộ phận cho ghi chú cũ. Cấp quản lý trung tâm ở đây là các role vốn có quyền đọc private: head, bod, coord, testeng. Chủ sở hữu vẫn có quyền quản trị toàn bộ theo wildcard gốc; các giới hạn append-only không nhằm thu hồi quyền owner.

## Kiểm thử

`npm run test:rules` khởi động Firestore Emulator trên 127.0.0.1:8085, dùng các project demo riêng cho bản nhận và candidate. Test từ chối chạy nếu thiếu đúng địa chỉ emulator. Không lấy credential Firebase thật.

Các ca kiểm tra: tái hiện lỗi Rules cũ; tổng quan R&D; tài khoản inactive; VM theo nhóm nguồn sau chuyển phòng; đọc trực tiếp private notes khác bộ phận/legacy; truy vấn private notes; tác giả và unit ghi chú; phản hồi R&D kèm ảnh/link; thread chat trái quyền; giả mạo tác giả; cập nhật tin chat; chat hai chiều bằng hai client realtime; audit một điều kiện; chèn/xóa trường và đóng VM trái quyền.

Kết quả tại máy ngày 08/09/2026: 10/10 bài Rules emulator đạt. Đã rút gọn việc tính vai trò/bộ phận trong các hàm quyền để phản hồi hợp lệ không chạm giới hạn biểu thức của Rules. Các lỗi permission-denied xuất hiện ở ca kiểm thử từ chối là kết quả mong đợi.

## Điều kiện trước nghiệm thu

1. Rules và Hosting candidate phải cùng được thử trên Firebase project test riêng hoặc emulator. Project **hub-ptn-test** đã được người dùng tạo; workflow develop đã chuyển cả Hosting và Rules sang project này. Chưa coi là đã triển khai nếu chưa có kết quả workflow thành công.
2. Kiểm tra document `hub_cases` thật không có nội dung riêng tư trong `confidential` hoặc trường khác. Cho đọc document là cho đọc mọi trường: không thể bảo đảm che dữ liệu bằng việc ẩn UI. Chưa đọc dữ liệu thật và chưa thực hiện migration.
3. Ghi chú legacy thiếu unitCode được giữ cho quản lý. Nếu cần mở lại cho bộ phận, cần xác minh nguồn gốc từng ghi chú trước migration, không suy từ nơi VM đang xử lý.
4. Nghiệm thu bằng tài khoản PTN/R&D thực tế và trình duyệt, gồm ảnh/file lớn, đổi phòng, đăng xuất, đổi thread. Kết quả emulator không đồng nghĩa Preview đã đạt.

Tham chiếu: [Firebase — kiểm thử Rules](https://firebase.google.com/docs/firestore/security/test-rules-emulator), [quyền theo trường và affectedKeys](https://firebase.google.com/docs/firestore/security/rules-fields), [các match chồng nhau](https://firebase.google.com/docs/rules/rules-behavior).
