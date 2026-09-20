# Architecture

Tài liệu này khóa các quyết định kiến trúc và kỹ thuật của backend.

Nếu code khác tài liệu này, phải sửa code hoặc cập nhật tài liệu có chủ ý. Không để nhiều cách tổ chức cùng tồn tại cho cùng một vấn đề.

`PROJECT_RULES.md` là luật gốc về coding style, naming và nguyên tắc tổ chức source.

`DATA_MODEL.md` là nguồn quyết định nghiệp vụ cho `prisma/schema.prisma`, quan hệ dữ liệu, ràng buộc và migration.

File này tập trung vào kiến trúc tổng thể và các quyết định kỹ thuật lớn.

---

# 1. Kiến trúc tổng thể

Project tổ chức theo feature/module nghiệp vụ.

Cấu trúc cấp cao:

```text
src/
├── modules/
├── database/
├── config/
├── common/
├── bootstrap/
├── validation/
├── logger/
├── app.module.ts
└── main.ts
```

Ý nghĩa:

```text
modules/       = nghiệp vụ của hệ thống
database/      = kết nối và cấu hình database
config/        = cấu hình application
common/        = thành phần thật sự dùng chung
bootstrap/     = cấu hình khởi động application
validation/    = validation dùng ở biên application
logger/        = cấu hình logging
app.module.ts  = module gốc ghép các module lớn
main.ts        = điểm khởi động application
```

Không mặc định áp dụng cấu trúc Clean Architecture với các tầng:

```text
presentation/
application/
domain/
infrastructure/
ports/
adapters/
use-cases/
```

Chỉ tách thêm khi có nhu cầu kỹ thuật thực tế và việc tách giúp code rõ ràng hơn.

---

# 2. Chia project theo feature

Các nghiệp vụ chính đặt trong:

```text
src/modules/
├── auth/
├── media/
├── categories/
├── artworks/
├── profile/
├── gallery/
└── analytics/
```

Dashboard là dữ liệu tổng hợp phục vụ đọc và không có model hoặc bảng riêng.

Có thể đặt xử lý dashboard trong module `analytics/` hoặc tách module đọc riêng nếu sau này logic đủ lớn, nhưng không tạo bảng Dashboard chỉ để phục vụ kiến trúc.

Module nhỏ có thể dùng cấu trúc phẳng:

```text
categories/
├── categories.controller.ts
├── categories.service.ts
├── categories.repository.ts
├── category.model.ts
└── categories.module.ts
```

Module lớn chỉ chia thư mục con khi thực sự cần:

```text
auth/
├── controllers/
├── services/
├── repositories/
├── dto/
├── models/
├── security/
├── guards/
├── decorators/
├── constants/
└── auth.module.ts
```

Không tạo thư mục rỗng chỉ để giống sơ đồ kiến trúc.

---

# 3. Luồng phụ thuộc chuẩn

Luồng xử lý HTTP chuẩn:

```text
HTTP Request
    ↓
Guard
    ↓
Controller
    ↓
Service
    ↓
Repository
    ↓
Prisma
    ↓
MySQL
```

Luồng trả kết quả:

```text
MySQL
  ↓
Prisma
  ↓
Repository
  ↓
Service
  ↓
Controller
  ↓
HTTP Response
```

Quy tắc:

- Controller chỉ xử lý HTTP boundary và gọi Service.
- Service chứa nghiệp vụ và điều phối các bước xử lý.
- Repository chịu trách nhiệm đọc/ghi database.
- Chỉ Repository được gọi Prisma trong code nghiệp vụ.
- Prisma model/type không được trả trực tiếp ra Controller.
- DTO HTTP không được truyền sâu xuống Repository.

Cấm các hướng gọi:

```text
Controller → Prisma
Controller → Repository
Service → Prisma
```

---

# 4. Database

- Database: MySQL 8+.
- ORM và migration: Prisma 7.
- `DATA_MODEL.md` là nguồn chuẩn cho model, field, enum, relation, index và referential action.
- Chỉ có một `PrismaService` dùng chung.
- `PrismaService` đặt trong `src/database` và được export qua `DatabaseModule`.
- Repository nhận `PrismaService` bằng dependency injection.
- Prisma-generated model/type không được lan sang Controller hoặc Service nếu đó là dữ liệu nghiệp vụ cần ổn định.
- Repository map dữ liệu Prisma sang model nội bộ khi cần.
- Query nên dùng `select` rõ ràng khi không cần toàn bộ record.
- Thao tác nhiều bước có thể để dữ liệu ở trạng thái dở dang phải chạy trong transaction.
- Transaction database đặt trong Repository khi nhiều thao tác Prisma phải thành công hoặc thất bại cùng nhau.
- Không dùng soft delete trong schema hiện tại.
- `DELETE` là hard delete và phải tuân thủ điều kiện nghiệp vụ, foreign key và referential action trong `DATA_MODEL.md`.
- Development dùng `prisma migrate dev`.
- Staging/production dùng `prisma migrate deploy`.
- Migration đã chạy không được sửa; thay đổi schema phải tạo migration mới.
- Timestamp được chuẩn hóa theo UTC; API trả timestamp theo RFC 3339 UTC.

---

# 5. Controller

Controller chịu trách nhiệm về HTTP.

Controller được phép:

```text
đọc body/query/param
đọc cookie/header
đọc authenticated user
set cookie
set response header
gọi Service
map kết quả sang response DTO/view model
trả response
```

Controller không được:

```text
query database trực tiếp
gọi Prisma
gọi Repository trực tiếp
hash password
tạo JWT trực tiếp
xử lý transaction
chứa nghiệp vụ chính
```

---

# 6. Service

Service chứa nghiệp vụ của feature.

Ví dụ với Auth:

```text
AuthController
    ↓
AuthService
    ├── AuthRepository
    ├── AccessTokenService
    ├── RefreshTokenService
    └── PasswordHasherService
```

Không mặc định tạo một class UseCase cho mỗi thao tác như:

```text
LoginUseCase
LogoutUseCase
RotateRefreshTokenUseCase
ChangePasswordUseCase
```

Nếu `AuthService` vẫn rõ ràng thì tiếp tục dùng một Service.

Chỉ tách thêm service/use case khi class trở nên quá lớn, nghiệp vụ đủ phức tạp hoặc cần tái sử dụng độc lập.

---

# 7. Repository

Repository là lớp duy nhất của feature được phép truy cập Prisma.

Ví dụ:

```text
AuthService
    ↓
AuthRepository
    ↓
PrismaService
    ↓
MySQL
```

Repository chịu trách nhiệm:

- Query database.
- Insert/update/delete dữ liệu.
- Transaction database.
- Thực hiện các thao tác nhiều record cần atomicity.
- Map Prisma data sang model nội bộ.

Repository không chứa các quyết định nghiệp vụ không liên quan trực tiếp đến lưu trữ dữ liệu.

Các thao tác reorder, rotation refresh token và mutation nhiều record phải thực hiện transaction theo quy tắc trong `DATA_MODEL.md`.

---

# 8. DTO và model nội bộ

DTO chỉ dùng ở HTTP boundary.

Luồng dữ liệu điển hình:

```text
LoginRequestDto
    ↓
LoginInput
    ↓
AuthService
    ↓
LoginResult
    ↓
LoginResponseDto
```

Model nội bộ là dữ liệu thuần, không phụ thuộc HTTP hoặc Prisma.

Ví dụ:

```ts
export type RefreshSession = {
  id: string;
  adminUserId: string;
  tokenHash: string;
  familyId: string;
  familyExpiresAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  replacedById: string | null;
  lastUsedAt: Date | null;
};
```

---

# 9. Config

Cấu hình application đặt trong:

```text
src/config/
├── app.config.ts
├── auth.config.ts
├── database.config.ts
└── config.module.ts
```

Quy tắc:

- Không đọc `process.env` rải rác trong project.
- Environment variable phải được đọc và validate tại config layer.
- Ứng dụng phải fail-fast nếu cấu hình bắt buộc không hợp lệ.
- Service/Repository nhận config qua dependency injection khi cần.

---

# 10. Common

`src/common` chỉ chứa thành phần thực sự được nhiều feature dùng chung.

Ví dụ:

```text
common/
├── constants/
├── decorators/
├── filters/
├── guards/
├── interceptors/
└── types/
```

Quy tắc:

```text
chỉ một module dùng
→ để trong module đó

nhiều module dùng
→ common/
```

Không biến `common/` thành nơi chứa mọi file khó phân loại.

---

# 11. Authentication

Đối tượng đăng nhập hiện tại:

- Chỉ có Admin được tạo bằng seed hoặc nghiệp vụ quản trị nội bộ.
- Không có API đăng ký public.
- Admin có role `OWNER` hoặc `EDITOR`.
- Admin đầu tiên được seed với role `OWNER`.

Access token:

- JWT ký bằng RS256.
- TTL mục tiêu: 15 phút (`JWT_ACCESS_TTL_SECONDS=900`).
- Payload: `sub`, `sid`, `jti`, `tokenUse=access`, `iat`, `exp`, `iss`, `aud`.
- Frontend chỉ giữ access token trong memory, không dùng `localStorage`.

Refresh token:

- Là opaque random token, không phải JWT.
- Database chỉ lưu SHA-256 hash, không lưu raw token.
- Client lưu raw refresh token trong HttpOnly cookie.
- Production dùng `Secure` và `SameSite` phù hợp topology domain.
- Refresh session được lưu trong MySQL.

Refresh token rotation:

- Mỗi lần refresh thành công revoke token/session cũ và tạo token/session mới.
- `sid` là ID của refresh-session row hiện tại và thay đổi sau mỗi rotation.
- `familyId` ổn định trong một lần login trên một thiết bị/trình duyệt.
- `familyExpiresAt` cố định từ lúc login và không được gia hạn.
- Reuse token đã rotate hoặc revoke phải được phát hiện và revoke toàn bộ token family.
- Idle TTL: 7 ngày và được tính lại sau refresh hợp lệ nhưng không vượt quá `familyExpiresAt`.
- Absolute session TTL: tối đa 90 ngày tính từ lúc login và không được gia hạn.

Protected Admin API:

- Verify JWT signature và các claim bắt buộc.
- Kiểm tra refresh session theo `sid` trong database.
- Kiểm tra session chưa revoke và chưa hết hạn.
- Kiểm tra Admin còn active.
- Kiểm tra quyền theo role khi endpoint yêu cầu.
- Redis nếu được thêm sau này chỉ là tối ưu, không thay đổi contract.

Logout:

- Revoke family hiện tại.
- Xóa refresh cookie.

Đổi mật khẩu:

- Verify mật khẩu hiện tại.
- Hash mật khẩu mới.
- Đặt `mustChangePassword = false` khi phù hợp.
- Revoke mọi refresh session của Admin.
- Xóa refresh cookie và yêu cầu đăng nhập lại.

Khi Admin bị vô hiệu hóa, toàn bộ refresh token family của Admin phải bị revoke.

Cookie-authenticated route phải kiểm tra Origin. Nếu deployment cần `SameSite=None`, phải có CSRF protection phù hợp.

---

# 12. Password

- Hash bằng Argon2id.
- Không mã hóa hai chiều và không lưu/log mật khẩu thô.
- Mật khẩu mới tối thiểu 12 ký tự.
- Không tự trim password.
- Login dùng lỗi chung cho username sai, password sai hoặc Admin inactive.
- Đổi mật khẩu phải verify mật khẩu hiện tại.
- Không cho mật khẩu mới trùng mật khẩu cũ.
- Seed và runtime phải dùng cùng Argon2id policy/parameters đã benchmark.

---

# 13. HTTP và response

- Request được validate tại HTTP boundary bằng DTO.
- Field không khai báo bị từ chối.
- Controller trả dữ liệu nghiệp vụ; response interceptor chịu trách nhiệm bọc success envelope khi endpoint có body.
- `DELETE` thành công trả `204 No Content` nếu endpoint không cần response body.
- `204 No Content` không có response body.
- Error response phải có machine-readable error code ổn định cho frontend.
- Không trả stack trace, Prisma error, SQL, secret hoặc credential ra client.

Chi tiết endpoint và response contract được khóa tại `API_CONTRACT.md`.

---

# 14. Media và object storage

- `MediaAsset` chỉ lưu metadata và storage key; không lưu public URL cố định.
- MediaAsset là immutable.
- Upload phải validate MIME type, magic bytes, dung lượng, kích thước ảnh và checksum.
- Thumbnail được tạo trong luồng upload.
- Upload trùng checksum trả lại asset đã tồn tại.
- MediaAsset chỉ được hard delete khi không còn reference.
- Database transaction và object storage không dùng chung transaction.
- Khi xóa MediaAsset, database record được xóa trước; object storage được cleanup sau bằng thao tác idempotent.
- Cleanup storage thất bại phải được log và retry.

---

# 15. Analytics và Dashboard

- Analytics lưu raw `AnalyticsEvent`.
- Không lưu IP, full user-agent, cookie, fingerprint, email hoặc dữ liệu nhận diện người dùng.
- `eventId` do client tạo và dùng để chống ghi trùng.
- Không tạo bảng aggregate/cache trong phiên bản đầu tiên.
- Dashboard tổng hợp trực tiếp từ dữ liệu hiện có và raw AnalyticsEvent.
- Raw AnalyticsEvent được giữ 400 ngày rồi hard delete bằng background cleanup.
- Nếu nhu cầu hiệu năng xuất hiện sau này mới xem xét aggregate/cache bằng migration mới.

---

# 16. Background jobs

Background job chỉ được thêm khi có nhu cầu nghiệp vụ thực tế.

Các job hiện được Data Model yêu cầu:

```text
cleanup RefreshTokenSession hết thời gian retention
cleanup AnalyticsEvent quá 400 ngày
đối soát và cleanup object storage mồ côi
```

Quy tắc:

- Xử lý theo batch.
- Có retry/backoff khi phù hợp.
- Thao tác phải idempotent nếu có thể.
- Không tạo side effect trùng khi job chạy lại.

---

# 17. Logging và request tracing

- Dùng Pino làm logger thống nhất.
- Không dùng `console.log()` hoặc `console.error()` trong production code.
- Request có `requestId` để đối chiếu client và log.
- Không log password, passwordHash, raw refresh token, access token, JWT secret, private key hoặc authentication cookie.

Logging phục vụ vận hành và chẩn đoán hệ thống; không có bảng `AuditLog` trong Data Model hiện tại.

---

# 18. Testing

Project dùng Vitest.

Các nhóm test khi cần:

```text
unit test
integration test
e2e test
```

Ưu tiên test các hành vi quan trọng:

```text
login
refresh token rotation
refresh token reuse detection
change password
permission checks
repository transaction
hard delete constraints
reorder
publish rules
analytics deduplication
health/readiness
```

Không mock mọi thứ một cách máy móc.

---

# 19. Nguyên tắc thay đổi kiến trúc

Không thêm abstraction chỉ vì pattern phổ biến.

Trước khi thêm một lớp như:

```text
Port
Adapter
BaseRepository
BaseService
GenericCrudService
Factory
Manager
Handler
Provider
```

phải có lý do kỹ thuật cụ thể.

Nếu kiến trúc cần thay đổi:

1. Nêu rõ vấn đề hiện tại.
2. Giải thích vì sao cấu trúc hiện tại không còn phù hợp.
3. Cập nhật `PROJECT_RULES.md`, `DATA_MODEL.md` hoặc file kiến trúc liên quan trước hoặc cùng lúc với code.
4. Không để hai pattern song song cho cùng một loại nghiệp vụ.

---

# 20. Công thức cần nhớ

```text
Request
  ↓
Guard
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
Prisma
  ↓
MySQL
```

Với Auth:

```text
AuthController
    ↓
AuthService
    ├── AuthRepository
    │     ↓
    │   Prisma
    │     ↓
    │   MySQL
    │
    ├── AccessTokenService
    ├── RefreshTokenService
    └── PasswordHasherService
```

Nguyên tắc chính:

```text
Controller = HTTP
Service    = nghiệp vụ
Repository = database
Prisma     = ORM
```
