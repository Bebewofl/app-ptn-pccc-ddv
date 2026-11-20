# HUB-01 — Báo cáo hiện trạng và candidate V3.0 LITE (20/11/2026)

## Phạm vi
HFI-HB; HUB-HFI (HFI Issue & Coordination Hub). Tái cấu trúc cùng repository và bảo toàn src/ V2, không merge main. Nhánh riêng hub-hfi-v3-lite xuất phát dd9a536fe5993b48ec777fecfd899f038a610950 (develop V2.2.8). Nhánh release V2.2.6 clean: 755a4c374cf03e926b742d1a3b1211f0480a4e4e. Main: a55d0b02b68dc5321a82e362fb8d1928378b2069. Production metadata trong repo: project app-ptn-pccc, V2.2.6; test hub-ptn-test. Không xác minh được Hosting live build-info, Authentication, IAM, Rules, Storage, số hồ sơ, app cùng project từ phiên này. Không thay đổi cloud.
 
## Hiện trạng và phân tích rủi ro
- src/index.html nhiều menu; app.js ~96k ký tự; interdept.js / operational-v226.js / chat.js / clean-ui.js là các lớp nghiệp vụ và UI bổ sung.
- createCase gán PTN nguồn, routeCase chọn desk cố định; thao tác case/event/attachment riêng nên có nguy cơ ghi một phần. Có trường confidential trong case. Firestore không che từng trường khi đọc document.
- loadAccessForUser ưu tiên owner/pilot theo email; ensureInitialPilotAccess tự ghi cấu hình cũ; candidate Rules cuối có wildcard owner. Không thay đổi hay sử dụng các quyền này trong V3.
- V2.2.8 có luồng CV, meal, chat, pins; các chức năng này không phục vụ trọng tâm mới. Tạm ẩn trong V3; giữ nguyên source và collections.
- docs/CONSOLIDATION.md, RULES-REVIEW.md, PREVIEW-CHECKLIST.md xác nhận baseline, vấn đề R&D/private notes, giới hạn kiểm thử; Rules nhận 08/09 chỉ là bản người dùng cung cấp, không xác nhận Rules đang live.
- Repository là public theo metadata GitHub; kiểm tra chính sách nội bộ và cân nhắc chuyển private sau khi chủ repository phê duyệt. Không đưa email nhân sự thật hoặc dữ liệu nghiệp vụ lên nhánh mới.

## Danh mục chức năng
| Nhóm | Candidate | Production |
|---|---|---|
| VM, tiếp nhận, chuyển cấp, phản hồi, xác nhận, kết luận | Thay thế luồng V2 bằng sáu trạng thái | Chưa phát hành |
| 4 trang + báo cáo nhanh + tìm kiếm/bộ lọc | Có | Chưa phát hành |
| Cổng HFI | Link/fallback quay về Cổng; đường dẫn hồ sơ có kiểm tra quyền | Chưa test SSO thật |
| Chat, phòng chung, cặp phòng, CV, pins, meal, reminder | Không tải các module này vào entry point Lite; giữ source và dữ liệu V2 | Giữ nguyên |
| File/ảnh | Chỉ link HTTPS đã phân quyền; upload Storage chưa triển khai | Chưa phát hành |
| Tạm dừng, ảnh hưởng tiến độ/chất lượng | Chưa triển khai flag riêng; khẩn cấp, quá hạn và reopen có luồng cơ bản | Chưa phát hành |
| Quản trị nghiệp vụ | Config theo UID qua seed demo, không có UI cấp quyền; chưa cấu hình thật | Chưa phát hành |
| Telegram | Sao chép mã + link, không gửi tự động; demo chỉ localhost | Chưa phát hành |

## Kiến trúc
Entry point src/lite/ trong cùng repository; dùng logo HFI cũ; Firebase Auth/Firestore SDK, candidate chạy trên emulator Auth + Firestore + Hosting (demo-hub-lite, localhost). Không có config thật trong Lite. Rules riêng deny-by-default, không dùng wildcard V2, không sửa Rules hiện hành. Nguồn dữ liệu mới: hub_v3_members/{uid} (tự đọc, không tự cấp quyền); hub_v3_directory/{uid} (danh bạ tối thiểu, không email); hub_v3_cases/{code}; events/{id} subcollection. Mã VM3-16 ký tự ngẫu nhiên tránh trùng VM cũ. Create/update + audit ghi cùng batch/transaction, getAfter kiểm tra đối ứng; event append-only với client; serverTimestamp, rev chống ghi đè đồng thời. Không dùng localStorage để lưu hồ sơ. Quản lý kỹ thuật không được tự sửa nghiệp vụ qua client; quản trị IAM/Admin SDK vẫn là đặc quyền hạ tầng cần phân tách và log riêng.
 
## Vai trò — cấu hình mẫu test, không phải quyết định tổ chức
| Vai trò | Tạo | Tiếp nhận/xử lý | Chuyển cấp | Quyết định | Đóng/mở lại | Đọc |
|---|---|---|---|---|---|---|
| TNV | Có, theo routes | Bổ sung nếu được yêu cầu | Không tự vượt tuyến; emergencyRoutes nếu khẩn | Không | Không | Hồ sơ tham gia |
| Trưởng nhóm | Có | Khi là nextUid | Theo routes, về TP | Không mặc định | Không mặc định | Hồ sơ tham gia |
| TP PTN | Có | Khi là nextUid | Theo routes | Khi được chỉ định và có canDecide | Nếu là reviewerUid, có canClose | Hồ sơ tham gia |
| TP PKT | Có | Khi là nextUid | Theo routes | Khi được chỉ định và có canDecide | Tương tự | Hồ sơ tham gia |
| TP QLCL | Có | Khi là nextUid | Theo routes | Khi được chỉ định và có canDecide | Tương tự | Hồ sơ tham gia, không điều động TNV |
| HCNS/Kho | Có | Khi là nextUid | Theo routes | Không mặc định | Nếu là reviewerUid, có canClose | Hồ sơ tham gia |
| Giám đốc | Có | Khi là nextUid | Theo routes | Khi được chỉ định và có canDecide | Nếu là reviewerUid, có canClose | Tổng quan nếu cấp overview |
| Quản trị kỹ thuật | Không mặc định | Không | Không | Không | Không | Không mặc định (danh bạ tối thiểu) |
Quyền quyết định hiện là capability nguyên tử canDecide; trước Production phải phân loại quyết định kỹ thuật/quản lý, phạm vi ủy quyền theo lĩnh vực, xác minh người phụ trách thay thế, quy chế đóng hồ sơ và quyền xem toàn bộ. Người từng tham gia giữ quyền đọc nội dung công khai, kể cả sau chuyển cấp; người mới được giao đọc lịch sử chung. Không nhập dữ liệu mật vào phần dùng chung. Chưa có private handling zone V3; chỉ lưu link đã kiểm soát quyền. 
 
## Vòng đời
Chờ tiếp nhận -> Đang xử lý -> (Chờ bổ sung -> Đang xử lý; Chờ quyết định -> Đang xử lý; Chuyển cấp -> Chờ tiếp nhận) -> Chờ xác nhận -> Đã đóng. Reviewer có thể yêu cầu xử lý tiếp hoặc mở lại có lý do. Không tự coi im lặng là đồng ý. Hạn phản hồi optional, quá hạn tính theo deadline; không tự kết thúc. Mặc định tạo nguồn theo member; không gán nguồn PTN.
 
## Kiểm thử
Workflow hub_lite_check.yml trên nhánh candidate; kiểm tra syntax, build, Rules Emulator, seed Auth + Hosting. Các test trong tests/lite/workflow.test.mjs dùng danh tính giả lập: route hợp lệ/khẩn; giả mạo; thiếu audit; read scope; admin không tự cấp; source đa phòng; chuyển trạng thái và route; quyết định cần căn cứ; đóng/mở lại; event append-only. Đây không thay thế browser/UAT. Kết quả thực chạy xem GitHub Actions tại commit tương ứng; không coi việc viết test là pass. Kiểm tra hồi quy V2 trên branch release/develop riêng; branch Lite chặn build/deploy production cũ.
 
## Chuyển đổi, sao lưu, phát hành, rollback
1. Trước khi chạm cloud: chủ Firebase xuất danh sách project/site/apps, Auth UID/claims, Rules hiện hành + version, indexes, Storage paths, IAM, billing/quotas; backup có manifest/hash, số hồ sơ/case/events/comments/attachments, thử restore vào môi trường cách ly.
2. Kiểm kê legacy: hub_cases, hub_case_events, hub_comments, private_notes, hub_interdept_chat, hub_tasks, hub_pins, hub_access, hub_meta, meal và attachments. Phân loại trường public/private và liên kết. Không suy ra quyền từ desk hoặc email; không auto cấp user. Giữ ID legacy và link đối chiếu. Không dùng client để chạy migration. Dry run theo allowlist trường, reconcile count và mapping; không migration nếu quyền chưa rõ; không reset/xóa.
3. Legacy read-only archive theo quyền được kiểm tra độc lập/migrated case reference (chưa triển khai). Chuyển hoặc tham chiếu từng hồ sơ mở đã được xác minh; append-only event migration ghi rõ nguồn, không giả mạo thời điểm gốc. Backup trước và kiểm tra đối chiếu sau.
4. Không dùng toàn bộ Rules emulator để deploy hub-ptn-test hay app-ptn-pccc. Sau khi có Rules thật của từng project, tích hợp match V3 và loại trừ V3 khỏi wildcard owner một cách có kiểm thử; không làm mất quyền app khác. Nếu project dùng chung không thể bảo đảm, cân nhắc Firebase project riêng với Cổng giữ nguyên HFI-HB.
5. Preview cloud chỉ sau review Rules, Auth, file, danh sách quyền và rollback. Nghiệm thu GĐ, PTN, PKT, QLCL, HCNS/Kho, TNV, admin. Tạo báo cáo <=60s đo thực tế; một click tiếp nhận; reload/đổi máy; mobile; deep link; kiểm tra trái quyền trực tiếp SDK; file; phục hồi bản sao. Không phát hành nếu fail.
6. Production cần phê duyệt user, version/hash, backup xác minh, lịch phát hành, rollback Hosting và Rules chính xác phiên bản trước; dữ liệu V3 giữ nguyên khi rollback, không xóa tự động.
 
## Hướng dẫn 1 trang (demo)
GitHub Desktop chọn hub-hfi-v3-lite, Fetch/Pull. Chạy PREVIEW_HUB_V3_LITE_LOCAL.cmd (Node 22/Java 21). Script cài dependencies khóa, kiểm tra/build, chạy Rules emulator test và mở localhost 5017 với tài khoản giả lập. Giữ cửa sổ chạy. Chọn TNV -> Báo cáo -> gửi Trưởng nhóm hoặc khẩn cấp tới đầu mối đã cấu hình. Đăng xuất -> chọn Trưởng nhóm -> Việc cần tôi xử lý -> Tiếp nhận một click -> chuyển TP PTN. TP chuyển PKT; PKT tiếp nhận, trả lời, báo đã xử lý; TP PTN xác nhận. Kiểm tra lịch sử, lọc, copy link, tài khoản QLCL/IT không được xem nếu không tham gia. Ctrl+C dừng. Dữ liệu demo không phải dữ liệu thật và không cam kết tồn tại sau restart emulator.
 
## ISO/IEC 17025
4.1/4.2: tách quyền quản trị-kỹ thuật, giới hạn đọc, cảnh báo bảo mật; 5.5-5.7/6.2: định danh, tuyến và ủy quyền cần phê duyệt; 7.5/7.11/8.4: record/audit/revision, quyền và backup; 7.10/8.5/8.7: issue/khắc phục không thay hồ sơ chuyên biệt; 8.9: báo cáo tổng quan hỗ trợ lãnh đạo. Chỉ là thiết kế hỗ trợ, chưa phải chứng nhận phù hợp ISO. Tham khảo https://www.iso.org/standard/66912.html và Firebase https://firebase.google.com/docs/firestore/manage-data/transactions , https://firebase.google.com/docs/firestore/security/rules-conditions , https://firebase.google.com/docs/firestore/quotas (1 MiB/doc, 10 calls riêng / 20 calls với atomic batch, cần đo chi phí thực tế). Không dùng nội dung đầy đủ của tiêu chuẩn nếu chưa đối chiếu bản kiểm soát tại HFI.
 
## Blockers
Không có quyền/đường truy cập xác minh Firebase live, dữ liệu/IP/Storage, backup hoặc deploy trực tiếp; không có UAT thực tế. Tài khoản và route demo không phải quyền thật. Chưa hỗ trợ upload, flags pause/impact, quản trị và quyền quyết định theo chuyên môn, đọc archive legacy, OAuth Google thực, tên/đơn vị lịch sử tại thời điểm event (UID và thời gian đã lưu, tên hiển thị theo danh bạ), phân quyền thu hồi/chuyển nhiệm vụ khi nhân sự nghỉ, bảo vệ riêng tư trong hồ sơ, pagination cho tập lớn. Chưa được phép phát hành.