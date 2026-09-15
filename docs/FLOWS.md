# Backend Flows

Tài liệu mô tả ngắn gọn các luồng chính của backend.

## 1. Khởi động ứng dụng

```text
main.ts
  ↓
bootstrap
  ↓
validate env
  ↓
khởi tạo NestJS
  ↓
kết nối MySQL
  ↓
setup HTTP middleware
  ↓
listen PORT
```

Nếu cấu hình bắt buộc hoặc database lỗi, ứng dụng không khởi động.

## 2. Health check

GET /health/live
  ↓
kiểm tra tiến trình ứng dụng còn hoạt động
  ↓
200

GET /health
GET /health/ready
  ↓
kiểm tra readiness của ứng dụng
  ↓
kiểm tra MySQL
  ↓
200 hoặc 503

## 3. Login

```text
POST /api/v1/admin/auth/login
  ↓
validate request
  ↓
tìm Admin
  ↓
verify password + trạng thái tài khoản
  ↓
tạo familyId + refresh token
  ↓
lưu refresh session
  ↓
tạo access token
  ↓
set HttpOnly refresh cookie
  ↓
200
```

Response:

```text
{ accessToken, admin }
```

## 4. Refresh token

```text
POST /api/v1/admin/auth/refresh
  ↓
đọc refresh cookie
  ↓
hash token
  ↓
tìm refresh session
  ↓
kiểm tra expiry, revoked, replaced, Admin active
  ↓
nếu token cũ bị dùng lại
  → revoke toàn bộ family
  → 401
  ↓
nếu hợp lệ
  → rotate session trong transaction
  → tạo refresh token mới
  → tạo access token mới
  → set cookie mới
  → 200
```

## 5. Gọi Admin API

```text
Request + Bearer access token
  ↓
AuthenticationGuard
  ↓
verify JWT
  ↓
kiểm tra refresh session + Admin
  ↓
PasswordChangeGuard
  ↓
AuthorizationGuard nếu cần
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
Prisma
```

## 6. Reload frontend

```text
Frontend reload
  ↓
POST /auth/refresh
  ↓
lưu access token vào memory
  ↓
GET /auth/me
  ↓
dựng auth state
```

## 7. Đổi mật khẩu

```text
PATCH /auth/change-password
  ↓
xác thực Admin
  ↓
verify currentPassword
  ↓
kiểm tra newPassword
  ↓
hash mật khẩu mới
  ↓
transaction:
- cập nhật passwordHash
- mustChangePassword = false
- revoke mọi refresh session
  ↓
xóa refresh cookie
  ↓
204
```

## 8. Logout

```text
POST /auth/logout
  ↓
đọc refresh cookie
  ↓
tìm session
  ↓
revoke family hiện tại
  ↓
xóa cookie
  ↓
204
```

Logout phải idempotent.

## 9. Upload Media

```text
POST /admin/media/images
  ↓
validate file
  ↓
lưu storage
  ↓
tạo metadata/thumbnail/checksum
  ↓
lưu MediaAsset
  ↓
ghi audit
  ↓
201
```

Nếu có lỗi giữa chừng phải cleanup dữ liệu đã tạo.

## 10. Category

```text
Controller
  ↓
CategoryService
  ↓
validate nghiệp vụ
  ↓
CategoryRepository
  ↓
Prisma
```

Reorder hoặc thao tác nhiều bước phải dùng transaction.

## 11. Artwork

```text
tạo Artwork
  ↓
DRAFT
  ↓
gắn Category
  ↓
gắn Media
  ↓
kiểm tra điều kiện publish
  ↓
PUBLISHED / HIDDEN / ARCHIVED
```

Publish chỉ thành công khi đủ dữ liệu bắt buộc.

## 12. Public API

```text
GET /api/v1/public/...
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
lọc dữ liệu public trong DB
  ↓
map sang public response
  ↓
200
```

Không trả draft, hidden, archived, deleted hoặc field nội bộ.

## 13. Analytics

```text
POST /public/analytics/events
  ↓
validate event
  ↓
kiểm tra eventId
  ↓
lưu event nếu chưa tồn tại
  ↓
aggregate
  ↓
202
```

Event trùng không được tăng counter lần hai.

## 14. Audit

```text
Admin mutation thành công
  ↓
lọc dữ liệu nhạy cảm
  ↓
ghi audit record
```

Không ghi password, token, private key hoặc secret.

## 15. Background jobs

```text
Scheduler/worker
  ↓
claim batch
  ↓
xử lý job
  ↓
commit
  ↓
retry có backoff nếu lỗi
```

Job phải tránh tạo side effect trùng.
