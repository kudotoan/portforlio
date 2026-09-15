# Roadmap Backend

Roadmap gồm đúng 13 bước. Trạng thái được đối chiếu với source ngày 2026-09-14.

- `DONE`: đã có code chính.
- `PARTIAL`: đã có một phần, chưa đủ để bàn giao.
- `NEXT`: việc nên làm tiếp theo.
- `PLANNED`: chưa triển khai.

OpenAPI, mã lỗi và test phải được làm cùng từng API. Bước 11 và 12 là vòng kiểm tra toàn hệ thống, không phải đợi tới cuối mới bắt đầu.

## 1. Project, Configuration và Bootstrap — DONE

- NestJS + TypeScript.
- Kiểm tra biến môi trường bằng Joi.
- Typed config cho app, database, rate limit và authentication.
- `main.ts` chỉ gọi bootstrap; setup ứng dụng nằm trong `src/bootstrap`.
- Có shutdown hooks.

Hoàn thành khi ứng dụng fail-fast nếu env bắt buộc sai và bootstrap không chứa nghiệp vụ.

## 2. Hạ tầng HTTP dùng chung — PARTIAL

Đã có:

- Global validation.
- Success response, exception filter.
- Request ID, Pino logging và ẩn dữ liệu nhạy cảm.
- CORS, Helmet, cookie parser và rate limit.

Còn thiếu:

- Mã lỗi ổn định cho frontend.
- Swagger/OpenAPI.
- Pagination contract dùng chung.
- Loại bỏ các route `/test-*` trước production.

## 3. DatabaseModule và PrismaService — DONE về code

- MySQL + Prisma.
- `DatabaseModule` export `PrismaService` qua dependency injection.
- Kết nối khi module khởi tạo, đóng kết nối khi ứng dụng dừng.
- Có schema, quan hệ, index và migration đầu tiên.

Còn phải kiểm chứng migration từ database rỗng và `prisma migrate status` trên MySQL local/test.

## 4. HealthModule — DONE về code

- `GET /health`: alias readiness.
- `GET /health/live`: kiểm tra tiến trình NestJS đã chạy.
- `GET /health/ready`: kiểm tra NestJS và MySQL.

Còn thiếu OpenAPI và e2e test cho trường hợp MySQL không sẵn sàng.

## 5. Seed dữ liệu hệ thống — DONE về code

- Tạo Admin đầu tiên.
- Tạo `Profile(default)` và `ThemeSettings(default)`.
- Hash mật khẩu Admin bằng Argon2id.
- Dùng upsert/transaction để chạy lại an toàn với cùng key.

Còn test seed hai lần trên database sạch và thống nhất tham số Argon2id giữa seed với runtime.

## 6. Authentication và Authorization — NEXT

Đã có:

1. Auth config và env.
2. Cookie parser.
3. Password service.
4. Access-token service.
5. Refresh-token service.
6. Auth repository + Prisma implementation.
7. Login.
8. Refresh-token rotation cơ bản.
(thiếu gia hạn mỗi lần /refresh)

Làm tiếp theo đúng thứ tự:

9. Reuse detection và revoke toàn bộ token family.
10. JWT guard, kiểm tra chữ ký/claim và refresh session trong DB.
11. `CurrentAdmin` decorator.
12. Guard bắt đổi mật khẩu lần đầu.
13. Đổi mật khẩu: kiểm tra mật khẩu cũ, hash mật khẩu mới, revoke mọi session.
14. Logout: revoke family hiện tại và xóa cookie.
15. `GET /me`.
16. Refresh expiry: idle 7 ngày, absolute tối đa 90 ngày.
17. Origin/CSRF protection, audit và e2e test.

Auth chỉ hoàn thành khi access token thực sự bảo vệ được Admin API và toàn bộ response/error khớp contract.

## 7. Storage abstraction và MediaModule — PLANNED

- `StoragePort` dùng chung; local cho development, S3-compatible/R2/MinIO cho production.
- Upload ảnh, kiểm tra dung lượng, MIME, magic bytes và decode.
- Lưu checksum, dimensions, derivative/thumbnail và blur placeholder.
- Soft delete; không xóa asset còn được tham chiếu.

Làm Media trước vì Category, Artwork, Profile, Gallery và Theme đều dùng ảnh.

## 8. CategoryModule và ArtworkModule — PLANNED

Category:

- CRUD, slug, cover image, visibility, reorder và soft delete.
- Không xóa/ẩn sai category đang được artwork public sử dụng.

Artwork:

- CRUD, draft/publish/hide/archive.
- Thumbnail, nhiều ảnh, primary category, category phụ, featured, SEO và reorder.
- Các thao tác thay relation/thứ tự chạy trong transaction.

Public chỉ đọc artwork `PUBLISHED`, chưa xóa và có primary category hợp lệ.

## 9. ProfileModule, ThemeModule và GalleryModule — PLANNED

- Profile singleton, skills và social links.
- Theme singleton, palette/font allow-list và version để invalid cache.
- Gallery dùng MediaAsset, có visibility, featured, reorder và soft delete.
- Có Admin API quản trị và Public API chỉ trả dữ liệu được phép hiển thị.

## 10. AuditModule và AnalyticsModule — PLANNED

Audit:

- Ghi actor, action, entity, request ID và before/after đã lọc secret.
- Audit writer phải có trước khi các mutation CMS ở bước 7–9 được đánh dấu hoàn thành.

Analytics:

- Nhận `PAGE_VIEW`, `ARTWORK_VIEW` theo `eventId` idempotent.
- Không lưu raw IP/session ID.
- Tổng hợp theo ngày, thống kê artwork và dọn raw event hết hạn bằng background job.

## 11. Chuẩn hóa toàn bộ API — PLANNED

- Request/response DTO và view model; không trả Prisma model trực tiếp.
- Pagination, filter, search và sort theo allow-list.
- Success/error response và machine-readable error code thống nhất.
- Swagger/OpenAPI có stable `operationId`, ví dụ request/response và security scheme.
- Kiểm tra contract không breaking trước khi frontend cập nhật client.

## 12. Kiểm thử — PARTIAL

- Unit test cho business rule/use case.
- Integration test cho Prisma repository, transaction, storage và job.
- E2E test cho Health, Auth, Admin CMS và Public API bằng test database riêng.
- Test race condition refresh token/reorder và kiểm tra không rò dữ liệu ẩn.

Hiện typecheck, Prisma schema validation và các unit test Auth đang đạt; lint và e2e toàn hệ thống chưa hoàn thiện.

## 13. Production hóa — PLANNED

- Docker image chạy non-root và compose cho local dependencies.
- CI: install, Prisma generate, typecheck, lint, test, build và OpenAPI diff.
- CD dùng `prisma migrate deploy`; không dùng `migrate dev`/`db push` ở production.
- Secret manager, TLS, CORS/cookie/CSRF đúng domain thực tế.
- Backup/restore MySQL và object storage, monitoring, alert và rollback guide.

## Kết luận

Thứ tự 13 bước này đã hợp lý. Bổ sung quan trọng nhất là: OpenAPI/test/audit phải đi cùng từng module; refresh session cần cả idle và absolute expiry; các background job cleanup/analytics phải được tính trước production. Việc tiếp theo của project hiện tại là **bước 6.9: reuse detection và revoke token family**.
