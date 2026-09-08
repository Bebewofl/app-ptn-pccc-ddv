# HUB-PTN V2.2.5 — bản kiểm thử

Nguồn phát triển duy nhất: `Bebewofl/app-ptn-pccc-ddv`, nhánh `develop`.
`main` và website production chưa được thay đổi bởi đợt hợp nhất này.

## Cách làm việc

1. GitHub Desktop: chọn đúng repo HUB, nhánh `develop`, Fetch/Pull.
2. Kiểm tra kết quả **HUB - 0. Kiểm tra bản mới** của commit vừa cập nhật.
3. Chạy **HUB - 1. Chạy Preview**, chọn nhánh **develop**. Workflow chỉ xuất Hosting vào `hub-v225-candidate`.
4. Test theo [ma trận Preview](docs/PREVIEW-CHECKLIST.md). Chưa được coi là đạt nếu thiếu kiểm thử quyền bằng Rules thực tế.

Không dùng ZIP, Downloads, CMD/PS1 để tạo bản mới. Không dùng các nút Production/Rollback cũ trên `main`: chúng vẫn trỏ nhánh lịch sử `hub-v225-oneclick` và nằm ngoài đợt sửa này.

## Nguồn và kiểm tra

- `src/`: mã ứng dụng duy nhất được đưa vào bản build.
- `VERSION.json`: phiên bản hiển thị và thông tin bản build.
- `baseline/v211/`: bản chụp Hosting V2.1.1, giữ nguyên để đối chiếu; **không phải bản sao Rules hoặc dữ liệu Firestore**.
- `baseline/v211-manifest.json`: nguồn và SHA-256 của bản chụp.
- `archive/v224-v225/`: bản cũ lưu dạng văn bản để đối chiếu; không chạy và không đưa lên Hosting.
- `npm run check`: kiểm tra cú pháp, kiểm thử hồi quy và tạo `dist/` hoàn toàn từ file trong repo, không tải production.
- `npm ci` rồi `npm run test:rules`: kiểm thử Rules bằng Firestore Emulator (Java 21), project `demo-*`, không dùng dữ liệu thật. GitHub tự chạy bước này trước Preview.
- `dist/build-info.json`: phiên bản, commit nguồn và mã kiểm tra nội dung nguồn.

Preview cần secret `FIREBASE_TOKEN` hiện dùng bởi workflow cũ. Không nhập token vào code/chat. Workflow này không triển khai Rules. Preview Hosting vẫn dùng Firebase project `app-ptn-pccc`, do đó đăng nhập và dữ liệu Firestore dùng chung với production; chỉ tạo VM test được thống nhất, không sửa VM nghiệp vụ thật.

Chi tiết rà soát: [CONSOLIDATION.md](docs/CONSOLIDATION.md).

Rules nhận từ người dùng và bản candidate được tách tại `rules/`. [Rà soát quyền và giới hạn triển khai](docs/RULES-REVIEW.md). Candidate thay đổi cách đọc private notes và truy vấn chat; Hosting và Rules phải được kiểm thử cùng nhau trên môi trường test. Workflow Hosting Preview không cập nhật Rules của Firebase project dùng chung.
