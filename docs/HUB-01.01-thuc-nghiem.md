# HUB-01.01 · HFI-HB · V3.0 LITE Candidate 02

## Điểm bàn giao

Nhánh hub-hfi-v3-lite phát triển từ Candidate 01 tại 2f7ddb87b79d14ba71b23e8aa9de63dd56019f6c. Giao diện, logo, bộ trạng thái, mã VM3, liên kết hồ sơ, danh bạ và các collection V3 kế thừa từ Candidate 01. Actions kiểm tra từng commit về hồi quy Candidate 01, nghiệp vụ Candidate 02, trình duyệt, sao lưu và phục hồi. Dữ liệu kiểm thử được tạo trong Emulator.

Ngày 20/11/2026, Hosting Test xác nhận V2.2.8 qua /build-info.json. Hai cấu hình Hosting công khai xác nhận project, miền Auth và bucket mang tên khác nhau giữa Test (hub-ptn-test) và Production (app-ptn-pccc). Console Test hiển thị Spark, Google Sign-In đã bật, Firestore (default) vùng asia-southeast1 có collection HUB cũ. Trang Storage yêu cầu nâng Blaze. Giá trị storageBucket trong cấu hình web chỉ là tên khai báo. Chưa khởi tạo tài nguyên cloud cho V3.

## Phạm vi chức năng

- Bốn màn hình nghiệp vụ, mặc định vào việc cá nhân, bảy chỉ số có thể chọn, tìm không dấu theo người/phòng/nội dung và bộ lọc. Liên kết hồ sơ yêu cầu xác thực và phân quyền. Nút Cổng giữ địa chỉ của Candidate 01. HUB dùng phiên Auth riêng.
- Ba trường bắt buộc, mặc định Bình thường. Người báo cáo, nguồn, mã VM3, giờ và audit do dịch vụ ghi nhận. Đích nhận theo bộ phận có đầu mối cấu hình hoặc theo người. Có hạn, YCTN, model, trạm, khách hàng, phối hợp, ảnh hưởng và hồ sơ hạn chế.
- Một chủ trì tại mỗi thời điểm. Tiếp nhận, phân công nội bộ, chuyển hoặc trả sai tuyến, mời nhiều bên, bổ sung, đề xuất, quyết định theo lĩnh vực, ghi kết quả, xác nhận, mở lại có lý do. Người xác nhận hoặc điều phối được cấp quyền có thể thay đầu mối khi quyền cần thiết của người cũ đã mất. Lưu bên chuyển, bên nhận, lý do, trạng thái và thời điểm.
- Người có quyền ghi tạm dừng và căn cứ. Việc cho tiếp tục cần thẩm quyền kỹ thuật phù hợp. Đầu mối có thể xin quyết định từ người được cấp quyền. Các mốc quá hạn không tự kết thúc hồ sơ.
- Tệp JPEG, PNG, WebP, PDF, DOCX, XLSX tối đa 5 MiB mỗi tệp. Tạo bản ghi chờ, tải object riêng, đối chiếu SHA-256, hoàn tất và ghi audit trong transaction. Nếu gián đoạn, gửi lại đúng tệp dùng cùng mã. Chỉ tệp hoàn tất được tải xuống. Hệ thống kiểm tra quyền từng lần và chặn bổ sung vào hồ sơ đã đóng. Ảnh và PDF có xem trước, tài liệu Office tải xuống.
- Nhắc việc trong ứng dụng theo cập nhật mới, đầu mối, hạn và khẩn. Mốc đã đọc được lưu trên máy chủ. Sao chép mã và đường dẫn để người dùng chủ động chia sẻ. Đồng bộ sau thao tác và theo chu kỳ 15 giây khi đang mở trang.
- Quản trị tài khoản kích hoạt UID Auth đã có, chỉnh bộ phận, chức vụ, tuyến, thẩm quyền, tạm khóa và ủy quyền có hạn theo phạm vi. Phiên Google nghiệm thu được đổi trong danh sách vai tổng hợp được cấp riêng. Audit ghi UID đăng nhập và vai sử dụng.

## Ma trận kiểm soát

| Chủ thể | Quyền thực tế | Điều kiện |
| --- | --- | --- |
| Người báo cáo, TNV | Tạo, bổ sung khi đến lượt, đính kèm hồ sơ mở | Nguồn từ tài khoản, đích nằm trong tuyến cấu hình |
| Chủ trì, trưởng nhóm, trưởng phòng | Tiếp nhận, phân công, mời phối hợp, báo kết quả | Đúng UID chủ trì và bước hiện hành |
| Người phối hợp | Đọc hồ sơ được mời, phản hồi và đính kèm | Chủ trì vẫn là người đang chịu trách nhiệm |
| Người xác nhận | Xác nhận, trả xử lý tiếp, mở lại | Là người xác nhận của hồ sơ và có quyền đóng |
| Người quyết định hoặc được ủy quyền | Chấp thuận, từ chối có căn cứ | Đúng lượt và lĩnh vực. Kiểm tra quyền của người ủy quyền và ngày hết hạn |
| Giám đốc | Tổng quan khi được cấp, quyết định quản lý, điều phối | Hồ sơ hạn chế yêu cầu tham gia, xác nhận kỹ thuật xét riêng |
| QLCL | Báo cáo, xác minh hệ thống, yêu cầu thông tin theo hồ sơ | Chỉ ghi nội dung phối hợp và tham chiếu hồ sơ kỹ thuật |
| Người chỉ xem | Tra cứu theo quyền tổng quan hoặc quyền trên hồ sơ | Kiểm tra quyền trước khi trả nội dung và tệp |
| Quản trị tài khoản | Kích hoạt, gán tuyến/quyền, ủy quyền và tạm khóa | Giới hạn bộ phận, phạm vi cấp, cấm tự sửa và chỉnh vai quản trị được bảo vệ |
| Quản trị kỹ thuật | Danh bạ tối thiểu trong HUB, vận hành theo IAM riêng | Quyền kỹ thuật không mặc định cấp quyền đọc hồ sơ hoặc quyết định |

## Kiểm kê nguồn cũ và bảo toàn

| Nguồn V2 theo mã | Đối chiếu trước chuyển thật |
| --- | --- |
| hub_cases, hub_case_events, hub_comments, ghi chú riêng và tệp | Ghi ID nguồn, tập con, thời gian, quyền đọc và SHA-256 của tệp. Kiểm tra độc lập quyền với nội dung riêng |
| hub_quality_handoffs, hub_audit_logs | Liên kết quyết định và dấu vết theo hồ sơ nguồn, giữ tác giả và thời điểm |
| hub_access, hub_meta | Đối chiếu UID, quyền và tuyến với danh sách duyệt |
| hub_interdept_chat, hub_common_room_requests, hub_tasks, hub_task_events, hub_pins, hub_meal_* | Bảo toàn ở V2 theo quyền cũ, ẩn các lối vào trong Lite |

Đây là kiểm kê logic theo mã. Chưa kiểm đếm hồ sơ, tài khoản và object thật. Trước chuyển thật cần manifest Firestore, phiên bản Rules, cấu hình Auth, IAM, Storage (tên, generation và hash), phiên bản Hosting. Xuất bản sao có kiểm soát truy cập, khôi phục vào môi trường riêng rồi so số lượng, liên kết, dấu vân tay. Giữ ID nguồn, đề xuất ánh xạ riêng cho hồ sơ đang mở và phê duyệt quyền nhận theo UID. Chưa thực hiện chuyển đổi dữ liệu thật.

Actions xuất Auth, Firestore và Storage từ Emulator, khởi động bộ Emulator mới, đọc lại document và nội dung object, so SHA-256 trên UID/trạng thái Auth, hồ sơ, sự kiện, phân quyền, dấu đọc và tệp. Artifact CI chỉ lưu dấu vân tay và ảnh giả lập.

## Phát hành Test và quay lui

1. Đích hiện tại là hub-ptn-test. Đối chiếu project, app, Auth, site, IAM, database, bucket và quyền thanh toán. Tài nguyên đề xuất gồm database hub-v3-lite, bucket hub-ptn-test-v3-lite, function hubLiteApi và kênh Hosting hub-v3-lite. Tách khỏi database mặc định và bucket V2. Kiểm tra tài nguyên hiện có trước khi tạo.
2. Giới hạn runtime vào database và bucket V3, cộng quyền tra cứu người dùng Auth Test. Bật uniform bucket-level access và public access prevention cho bucket chuyên biệt. Rules của đúng database/bucket V3 chặn toàn bộ truy cập trực tiếp. Người triển khai cần quyền đọc metadata Test; quyền ghi chỉ ở Hosting preview, Rules V3 và function V3, cùng actAs đúng service account. Không cần Owner hoặc quyền Production. Dùng danh tính ngắn hạn.
3. Build Test bằng node scripts/build-lite.mjs test. Phát hành qua kênh preview ghi trong cấu hình; lưu URL Firebase trả về, hạn sử dụng, phiên bản function được ghim và xác minh miền Google Auth. Dùng cấu hình firebase.lite.test.json theo từng tài nguyên đã xác minh. Không áp dụng script phát hành V2.
4. scripts/lite-test-profiles.mjs hub-ptn-test --check kiểm tra các vai tổng hợp. Chế độ --apply chỉ tạo các UID pilot-* còn thiếu và giữ hồ sơ đã tồn tại. UID Google được HFI xác nhận làm người nghiệm thu có thể dùng các vai tổng hợp được gán đích danh. Chế độ này chưa chạy trên cloud.
5. Xác minh ngoài mạng công ty trên hai thiết bị, Google Sign-In, liên kết sâu, chuyển vai, quyền tệp, thao tác đồng thời và khôi phục. Đo thời gian báo cáo với người dùng thật trước khi bàn giao URL.
6. Khi rollback, phục hồi phiên bản trước đã lưu của kênh thử và function hoặc ngừng kênh thử. Giữ dữ liệu V3 để đối soát. Nếu có thay đổi Rules V3, phục hồi đúng ruleset ID của tài nguyên tương ứng. Production cần quyết định riêng sau UAT, sao lưu/khôi phục, kiểm tra quyền, nghiệm thu P0/P1 và kế hoạch quay lui được duyệt.

## Phạm vi xác minh

Kho mã hiển thị Public. Trên 147 commit có thể truy cập ở mốc Candidate 01, phép quét mẫu tìm thấy địa chỉ email cá nhân trong 23 blob thuộc 14 đường dẫn lịch sử. Ba đường dẫn có khóa cấu hình Firebase Web. Phép quét mẫu không chứng minh toàn bộ lịch sử sạch. Không sao chép giá trị định danh vào báo cáo. Nguồn V2 được bảo toàn. Chủ kho quyết định chuyển Private và kiểm tra quyền hiện có; nếu xác định có bí mật đặc quyền từng lộ, thu hồi/đổi bí mật và xử lý lịch sử sau sao lưu, phê duyệt. Đổi chế độ hiển thị không thu hồi được bản đã sao chép.

CI dùng tài nguyên giả lập và không phát hành cloud. Kho V2 tra qua hệ thống cũ theo quyền hiện hành. SSO hai chiều, kiểm tra điện thoại vật lý, hiệu năng theo khối lượng dữ liệu thật và nghiệm thu của người sử dụng cần kết quả riêng. C02 hỗ trợ trách nhiệm, kiểm soát hồ sơ và truy vết. Đánh giá sự phù hợp ISO thuộc quy trình của HFI.
