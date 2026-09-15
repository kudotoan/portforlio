# Architecture

File này khóa các quyết định kỹ thuật của backend. Nếu code khác tài liệu, phải sửa code hoặc cập nhật quyết định có chủ ý; không để hai cách cùng tồn tại.

## Database

- Database: MySQL 8+.
- ORM và migration: Prisma 7.
- Application không gọi Prisma trực tiếp.
- Repository port đặt ở `application/ports`.
- Prisma implementation đặt ở `infrastructure/persistence`.
- `PrismaService` thuộc `src/platform/database` và được inject qua `DatabaseModule`.
- Prisma model không được trả trực tiếp từ controller; phải map sang application model/view model.
- Thao tác nhiều bước có thể để dữ liệu dở dang phải chạy trong transaction.
- Development dùng `prisma migrate dev`; staging/production chỉ dùng `prisma migrate deploy`.
- Migration đã chạy không được sửa; thay đổi schema phải tạo migration mới.
- Timestamp được application/connection chuẩn hóa theo UTC; API trả RFC 3339 UTC.

## Authentication

- Đối tượng đăng nhập V1: Admin được tạo bằng seed; không có API đăng ký public.
- Access token: JWT ký bằng RS256.
- Access token TTL mục tiêu: 15 phút (`JWT_ACCESS_TTL_SECONDS=900`). Code hiện tại mặc định 10 phút, cần đổi về 900 khi hoàn thiện Auth.
- Access token payload: `sub`, `sid`, `jti`, `tokenUse=access`, `iat`, `exp`, `iss`, `aud`.
- Access token lưu phía frontend: memory, không dùng `localStorage`.
- Refresh token: opaque random token, không phải JWT.
- Refresh token trong database: chỉ lưu SHA-256 hash, không lưu raw token.
- Refresh token lưu phía client: HttpOnly cookie; production dùng `Secure`, `SameSite` theo topology domain.
- Refresh session lưu trong MySQL.
- Refresh token rotation: có; mỗi refresh thành công revoke token cũ và phát refresh token mới.
- `sid`: ID của refresh-session row hiện tại; thay đổi sau mỗi rotation.
- `familyId`: ID ổn định của một lần login trên một thiết bị/trình duyệt.
- Reuse detection: dùng lại token đã rotation sẽ revoke toàn bộ token family và yêu cầu login lại.
- Refresh idle TTL mục tiêu: 7 ngày tính lại sau refresh hợp lệ.
- Absolute session TTL mục tiêu: tối đa 90 ngày từ login, không được gia hạn.
- Logout: revoke family hiện tại và xóa refresh cookie.
- Đổi mật khẩu: kiểm tra mật khẩu cũ, cập nhật hash và revoke mọi session của Admin.
- Protected Admin API kiểm tra JWT và refresh session/Admin trong DB. Redis chỉ là tối ưu sau này, không thay đổi contract.
- Frontend gặp nhiều 401 đồng thời phải dùng single-flight refresh; chỉ một request `/refresh` được chạy.
- Cookie-authenticated route phải kiểm tra Origin. Nếu dùng cookie cross-site với `SameSite=None`, phải có CSRF protection.

## Password

- Hash: Argon2id.
- Không mã hóa hai chiều và không lưu/log mật khẩu thô.
- Mật khẩu mới tối thiểu 12 ký tự.
- Không tự trim password.
- Login dùng lỗi chung cho username sai, password sai hoặc Admin inactive.
- Đổi mật khẩu bắt buộc verify mật khẩu hiện tại và từ chối mật khẩu mới trùng mật khẩu cũ.
- Seed và runtime phải dùng cùng Argon2id policy/parameters đã benchmark.

## Layers

```text
presentation
    ↓
application
    ↓
domain

infrastructure ── implements ──> application ports
```

- `domain`: entity, value object, enum, invariant và business rule thuần; không import NestJS, Prisma hoặc HTTP DTO.
- `application`: use case, input/output model, port và transaction boundary; điều phối nghiệp vụ, không phụ thuộc Prisma implementation.
- `infrastructure`: Prisma repository, storage adapter, token/crypto implementation và background job.
- `presentation`: controller, HTTP DTO, guard, decorator và view model; validate request, gọi use case và trả response.

Mỗi feature đặt trong `src/modules/<feature>` và có tối đa bốn layer trên. Module nhỏ có thể ít file hơn, nhưng không đảo chiều dependency. `src/platform` chỉ chứa hạ tầng dùng chung như config, database, HTTP, health, logging và security; không chứa nghiệp vụ Artwork/Profile/Theme.
