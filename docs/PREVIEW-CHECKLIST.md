# Ma trận nghiệm thu Preview V2.2.5

Trạng thái ban đầu: **CHƯA NGHIỆM THU**. Ghi commit từ `build-info.json`, ngày, tài khoản/vai trò và kết quả cho từng dòng. Đổi commit thì kiểm thử lại phần bị ảnh hưởng.

| Kiểm tra | Kết quả yêu cầu | Trạng thái |
|---|---|---|
| Khởi động/phiên bản | Không màn hình trắng; một nhãn V2.2.5; commit trùng bản định test | Chưa test Preview |
| VM chuyển PTN → R&D → phòng khác | Người báo/nhóm nguồn vẫn thấy VM và trạng thái công khai, cả sau F5 | Chưa test Preview |
| R&D → PTN | VM có nguồn RD vẫn xuất hiện đúng luồng; PTN phản hồi được khi đang chịu trách nhiệm | Chưa test Preview |
| Phản hồi R&D | Nội dung, ảnh, file nhỏ và link được lưu đúng VM; PTN đọc lại được | Chưa test Preview |
| Tạo hai VM gần nhau | Tệp vào đúng mã VM transaction trả về; tạo lỗi không sinh tệp mồ côi | Chưa test Preview |
| Audit | Lịch sử theo thời gian; không yêu cầu composite index | Chưa test Preview |
| Chat PTN ↔ R&D | Hai tài khoản, hai trình duyệt; gửi hai chiều thấy ngay không F5 | Chưa test Preview |
| Thread | VM-011, VM khác, GENERAL không trộn tin; đổi nhanh không hiện callback cũ | Chưa test Preview |
| Chat lịch sử | Tin V2.2.2/V2.2.3 còn đọc được khi Rules cho phép | Chưa test Preview |
| Xác nhận PTN | Hoàn thành/làm bổ sung đúng trạng thái; giữ dấu phối hợp RD | Chưa test Preview |
| R&D mở rộng | Chỉ tài khoản có permission đọc tổng quan công khai PTN | Chưa test Preview |
| Private handling | Đọc trực tiếp bằng SDK với tài khoản sai bộ phận bị Rules từ chối; không có dữ liệu riêng trong public document | Đã có Rules; chờ nghiệm thu dữ liệu/môi trường test |
| Đăng xuất/đổi tài khoản | Không còn listener, nội dung VM/chat hoặc cache của tài khoản trước | Chưa test Preview |

Chỉ khi tất cả đạt mới đề xuất phát hành production riêng. Không triển khai Rules vào project dùng chung để thử một cách tự động.
