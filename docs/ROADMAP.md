# Roadmap

Roadmap phát triển backend Portfolio Art API.

Quy ước trạng thái:

- `DONE`: đã hoàn thành.
- `NEXT`: việc đang làm tiếp theo.
- `PLANNED`: chưa triển khai.

## 1. Project, Configuration và Bootstrap — DONE

- Khởi tạo NestJS + TypeScript.
- Chuẩn hóa cấu trúc thư mục.
- Cấu hình ESLint và formatter.
- Validate biến môi trường bằng Joi.
- Tách bootstrap theo chức năng.
- Thiết lập shutdown hooks.

## 2. Hạ tầng HTTP dùng chung — PLANNED

- Global ValidationPipe.
- Success response interceptor.
- Error response chuẩn.
- Request ID và Pino logging.
- CORS.
- Helmet.
- Cookie parser.
- Pagination dùng chung.
- Swagger/OpenAPI.
- Rate limit tạm hoãn do chưa phù hợp version hiện tại.

## 3. Database và Prisma — NEXT

- MySQL 8+.
- Cài và cấu hình Prisma 7.
- Tạo `PrismaService` dùng chung.
- Tạo `DatabaseModule`.
- Data model — DONE.
- Viết `schema.prisma`.
- Tạo migration đầu tiên.

## 4. Health — PLANNED

- `GET /health`.
- `GET /health/live`.
- `GET /health/ready`.
- `/health` là alias của `/health/ready`.
- Readiness kiểm tra MySQL.
- Test health/readiness.

## 5. Seed dữ liệu hệ thống — PLANNED

- Tạo Admin đầu tiên với role `OWNER`.
- Tạo Profile mặc định có `id = "default"`.
- Hash mật khẩu bằng Argon2id.
- Thiết lập `mustChangePassword`.
- Seed phải chạy an toàn nhiều lần khi phù hợp.

## 6. Authentication và Authorization — PLANNED

- Hoàn thiện DTO và response model Auth.
- Login.
- Access token RS256.
- Refresh token opaque.
- Refresh token rotation.
- Reuse detection.
- Idle TTL 7 ngày.
- Absolute family TTL 90 ngày.
- `sid` gắn với `RefreshTokenSession.id`.
- Kiểm tra session theo `sid` ở protected Admin API.
- JWT guard.
- CurrentAdmin.
- Role `OWNER` / `EDITOR`.
- Authorization guard.
- Bắt đổi mật khẩu lần đầu.
- Change password.
- Logout.
- `/me`.
- Revoke session khi Admin bị vô hiệu hóa.
- Origin/CSRF protection cho cookie-authenticated route.
- Test Auth.

## 7. Media — PLANNED

- Hoàn thiện Media API contract.
- Storage abstraction.
- Upload ảnh.
- Validate magic bytes, MIME type, dung lượng và kích thước.
- Tính SHA-256 checksum.
- Chống lưu trùng theo checksum.
- Tạo thumbnail WebP.
- Lưu `MediaAsset`.
- Hard delete khi không còn reference.
- Cleanup object storage khi upload/xóa thất bại một phần.
- Test Media.

## 8. Category và Artwork — PLANNED

- Hoàn thiện Category/Artwork API contract.
- CRUD Category.
- CRUD Artwork.
- Artwork status và state transition.
- Publish rule.
- Artwork–Category relation.
- Artwork–Media relation.
- Ảnh `position = 0` là ảnh chính.
- Reorder Category.
- Reorder Artwork.
- Reorder ArtworkImage.
- Hard delete theo quy tắc nghiệp vụ.
- Test Category và Artwork.

## 9. Profile và Gallery — PLANNED

- Hoàn thiện API contract.
- Profile singleton `default`.
- Avatar.
- Skill.
- Reorder Skill.
- SocialLink.
- Reorder SocialLink.
- GalleryImage.
- Reorder GalleryImage.
- Hard delete dữ liệu liên kết đúng quy tắc.
- Test Profile và Gallery.

## 10. Analytics và Dashboard — PLANNED

- Hoàn thiện Analytics API contract.
- `AnalyticsEvent`.
- Event type `SITE_VIEW`.
- Event type `ARTWORK_VIEW`.
- Chống ghi trùng theo `eventId`.
- Validate `occurredAt`.
- Không lưu dữ liệu nhận diện người dùng.
- Dashboard summary.
- Analytics overview.
- Analytics trend.
- Analytics theo Artwork.
- Tổng hợp trực tiếp từ dữ liệu hiện có và raw `AnalyticsEvent`.
- Không tạo bảng aggregate/cache trong phiên bản đầu tiên.
- Test Analytics và Dashboard.

## 11. Background Jobs — PLANNED

- Cleanup `RefreshTokenSession` hết thời gian retention.
- Cleanup `AnalyticsEvent` quá 400 ngày.
- Đối soát object storage.
- Cleanup object mồ côi.
- Batch processing.
- Retry/backoff khi cần.
- Đảm bảo idempotency.
- Test background jobs.

## 12. Rà soát API toàn hệ thống — PLANNED

- DTO request.
- Response model.
- Error code.
- Pagination.
- Filter.
- Search.
- Sort.
- Reorder payload.
- Hard delete behavior.
- OpenAPI contract.
- Kiểm tra tính thống nhất giữa các feature.
- Kiểm tra breaking change.

## 13. Kiểm thử tổng thể — PLANNED

- Unit test cho logic quan trọng.
- Integration test.
- E2E test.
- Test transaction.
- Test race condition.
- Test refresh token rotation.
- Test refresh token reuse detection.
- Test hard delete constraint.
- Test reorder.
- Test publish rule.
- Test analytics deduplication.
- Test các luồng liên module quan trọng.

## 14. Production — PLANNED

- Docker.
- CI/CD.
- Migration production bằng `prisma migrate deploy`.
- Secret management.
- TLS.
- CORS.
- Cookie security.
- CSRF protection.
- Backup database.
- Monitoring.
- Log aggregation.
- Rollback strategy.
- Object storage backup/lifecycle nếu cần.

## 15. Thứ tự triển khai hiện tại

```text
Database + Prisma
  ↓
Health
  ↓
Seed
  ↓
Authentication + Authorization
  ↓
Media
  ↓
Category + Artwork
  ↓
Profile + Gallery
  ↓
Analytics + Dashboard
  ↓
Background Jobs
  ↓
Rà soát API
  ↓
Kiểm thử tổng thể
  ↓
Production
```

Bước đang thực hiện:

```text
3. Database và Prisma
```

Việc tiếp theo:

```text
tạo PrismaService
  ↓
viết schema.prisma từ DATA_MODEL.md
  ↓
tạo migration đầu tiên
  ↓
kiểm tra migration trên database sạch
```
