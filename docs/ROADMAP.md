# Roadmap

Roadmap phát triển backend Portfolio Art API.

Quy ước trạng thái:

- `DONE`: đã hoàn thành.
- `NEXT`: việc đang làm tiếp theo.
- `PLANNED`: chưa triển khai.

## 1. Project, Configuration và Bootstrap — DONE

- Khởi tạo NestJS + TypeScript.
- Chuẩn hóa cấu trúc thư mục.
- Cấu hình linter và formatter.
- Validate biến môi trường bằng Joi.
- Thiết lập bootstrap và shutdown hooks.

## 2. Hạ tầng HTTP dùng chung — NEXT

- Validation.- done
- Request ID và logging. - done
- Success/error response. 
- CORS, Helmet, cookie parser, rate limit.
- Pagination dùng chung.
- Thiết lập Swagger/OpenAPI.

## 3. Database và Prisma — PLANNED

- MySQL 8+.
- PrismaService dùng chung.
- Hoàn thiện data model.
- Schema và migration.
- Kiểm tra migration trên database sạch.

## 4. Health — PLANNED

- `/health`
- `/health/live`
- `/health/ready`

## 5. Seed dữ liệu hệ thống — PLANNED

- Admin đầu tiên.
- Profile mặc định.
- Theme mặc định.
- Hash mật khẩu bằng Argon2id.

## 6. Authentication và Authorization — PLANNED

- Hoàn thiện Auth API contract.
- Login.
- Access token.
- Refresh token rotation.
- Reuse detection.
- JWT guard.
- CurrentAdmin.
- Bắt đổi mật khẩu lần đầu.
- Change password.
- Logout.
- `/me`.
- Idle và absolute session expiry.
- Origin/CSRF protection.
- Test Auth.

## 7. Media — PLANNED

- Hoàn thiện Media API contract.
- Storage abstraction.
- Upload ảnh.
- Validate file.
- Metadata, thumbnail, checksum.
- Soft delete.
- Audit các mutation cần thiết.
- Test Media.

## 8. Category và Artwork — PLANNED

- Hoàn thiện Category/Artwork API contract.
- CRUD Category.
- CRUD Artwork.
- Status và publish rule.
- Category relation.
- Image relation.
- Reorder và soft delete.
- Audit các mutation cần thiết.
- Test Category và Artwork.

## 9. Profile, Theme và Gallery — PLANNED

- Hoàn thiện API contract.
- Profile.
- Skills.
- Social links.
- Theme.
- Gallery.
- Audit các mutation cần thiết.
- Test Profile, Theme và Gallery.

## 10. Audit và Analytics — PLANNED

- Hoàn thiện Audit/Analytics API contract.
- Audit log.
- Analytics event.
- Aggregate dữ liệu.
- Background job.
- Test Audit và Analytics.

## 11. Rà soát API toàn hệ thống — PLANNED

- DTO và response model.
- Error code.
- Pagination, filter, search, sort.
- OpenAPI contract.
- Kiểm tra tính thống nhất giữa các feature.
- Kiểm tra breaking change.

## 12. Kiểm thử tổng thể — PLANNED

- Integration test.
- E2E test.
- Test transaction.
- Test race condition.
- Test các luồng liên module quan trọng.

## 13. Production — PLANNED

- Docker.
- CI/CD.
- Migration production.
- Secret management.
- TLS, CORS, cookie, CSRF.
- Backup, monitoring và rollback.
