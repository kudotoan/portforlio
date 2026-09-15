# Backend Flows

Các flow dưới đây mô tả hành vi đích. Route nào đã chạy hoặc còn dự kiến được đánh dấu trong [APIcontract.md](./APIcontract.md).

## Khởi động ứng dụng

```text
Node.js chạy main.ts
  ↓
gọi bootstrap()
  ↓
đọc và validate env
  ↓ sai
dừng ứng dụng, báo lỗi cấu hình
  ↓ đúng
tạo Nest application
  ↓
kết nối Prisma/MySQL
  ↓
setup logger, cookie, CORS, Helmet, validation, response/error, rate limit
  ↓
listen PORT
```

Kết quả: ứng dụng sẵn sàng nhận request. Nếu env hoặc database bắt buộc lỗi lúc startup, ứng dụng không listen.

## Health check

```text
GET /health/live
  ↓
kiểm tra tiến trình NestJS đang phục vụ request
  ↓
200 { status: "ok", timestamp }
```

```text
GET /health/ready hoặc /health
  ↓
chạy SELECT 1 tới MySQL
  ↓ thành công                     ↓ thất bại
200 { status, checks }             503 SERVICE_UNAVAILABLE
```

## Đăng nhập Admin

```text
Client
  ↓
POST /api/v1/admin/auth/login
  ↓
validate username/password
  ↓
normalize username
  ↓
tìm Admin credentials trong DB
  ↓
kiểm tra Admin active và verify Argon2id password
  ↓ sai
401 AUTH_INVALID_CREDENTIALS
  ↓ đúng
tạo familyId và refresh token ngẫu nhiên
  ↓
hash refresh token, lưu RefreshTokenSession
  ↓
ký access token JWT với sid của session
  ↓
cập nhật lastLoginAt
  ↓
đặt refresh token vào HttpOnly cookie
```

Response: `200 { accessToken, admin }`. Refresh token không nằm trong JSON.

## Refresh token

```text
Client
  ↓
POST /api/v1/admin/auth/refresh
  ↓
đọc refresh token từ HttpOnly cookie
  ↓ thiếu
401 AUTH_REFRESH_TOKEN_MISSING
  ↓ có
hash token
  ↓
tìm RefreshTokenSession trong DB, kể cả row đã revoked
  ↓
kiểm tra:
- tồn tại?
- hết idle/absolute expiry?
- Admin còn active?
- revoked/replaced/token đã từng được dùng?
  ↓ token cũ đã rotation
revoke toàn bộ token family
  ↓
xóa cookie
  ↓
401 AUTH_REFRESH_TOKEN_REUSED
  ↓ token active
rotate atomically trong transaction
  ↓
revoke token cũ với reason ROTATED
  ↓
tạo refresh token/session mới, giữ nguyên familyId
  ↓
đặt replacedById của row cũ
  ↓
ký access token mới với sid mới
  ↓
đặt refresh token mới vào HttpOnly cookie
```

Response: `200 { accessToken }` + cookie mới. Frontend chỉ cho một refresh request chạy tại một thời điểm.

## Gọi Admin API được bảo vệ

```text
Client gửi Authorization: Bearer <accessToken>
  ↓
JWT guard đọc token
  ↓
verify RS256 signature, exp, iss, aud, sub, sid, jti, tokenUse
  ↓ sai
401 AUTH_ACCESS_TOKEN_INVALID hoặc AUTH_ACCESS_TOKEN_EXPIRED
  ↓ đúng
tìm RefreshTokenSession theo sid
  ↓
kiểm tra session chưa expired/revoked/replaced và Admin active
  ↓ sai
401 AUTH_SESSION_INVALID
  ↓ đúng
gắn CurrentAdmin vào request
  ↓
password-change guard kiểm tra mustChangePassword
  ↓ bị chặn
403 AUTH_PASSWORD_CHANGE_REQUIRED
  ↓ được phép
controller → use case → repository
```

Response: tùy API. Frontend chỉ thử refresh một lần khi nhận 401; không refresh khi nhận 403.

## Bootstrap phiên sau khi reload frontend

```text
Frontend reload, access token trong memory đã mất
  ↓
POST /api/v1/admin/auth/refresh với credentials: include
  ↓ thành công
lưu access token mới trong memory
  ↓
GET /api/v1/admin/auth/me
  ↓
nhận AdminSessionView
  ↓
dựng auth state và kiểm tra mustChangePassword
```

Response cuối: `200 AdminSessionView`. Nếu refresh hoặc `/me` thất bại, frontend xóa auth state và chuyển về login.

## Đổi mật khẩu

```text
PATCH /api/v1/admin/auth/change-password
  ↓
JWT guard xác thực Admin
  ↓
verify currentPassword với passwordHash hiện tại
  ↓ sai
422 AUTH_CURRENT_PASSWORD_INVALID
  ↓ đúng
kiểm tra newPassword hợp lệ và không trùng mật khẩu cũ
  ↓
hash newPassword bằng Argon2id
  ↓
transaction:
- cập nhật passwordHash
- đặt mustChangePassword = false
- revoke mọi refresh session của Admin
  ↓
xóa refresh cookie
```

Response: `204 No Content`. Frontend xóa access token và yêu cầu đăng nhập lại.

## Logout

```text
POST /api/v1/admin/auth/logout
  ↓
đọc refresh cookie nếu có
  ↓
hash và tìm session nếu token hợp lệ
  ↓
revoke toàn bộ family hiện tại
  ↓
xóa refresh cookie bằng đúng name/path/options
```

Response: luôn `204 No Content`. Logout là idempotent; cookie đã hết hạn vẫn trả 204.

## Upload Media

```text
POST /api/v1/admin/media/images
  ↓
JWT/password-change guard
  ↓
kiểm tra size, extension, MIME, magic bytes và decode ảnh
  ↓ sai
413 MEDIA_TOO_LARGE hoặc 415 MEDIA_TYPE_UNSUPPORTED
  ↓ đúng
sinh storage key phía server
  ↓
lưu ảnh qua StoragePort
  ↓
tạo thumbnail/derivatives và đọc dimensions/checksum
  ↓
lưu MediaAsset trong DB
  ↓
ghi audit
```

Response: `201 AdminMediaView`. Nếu DB/processor lỗi, backend thực hiện cleanup/compensation để không để file hoặc row mồ côi.

## Xóa Media

```text
DELETE /api/v1/admin/media/:id
  ↓
tìm MediaAsset chưa xóa
  ↓
kiểm tra reference từ Category/Artwork/Profile/Theme/Gallery
  ↓ còn dùng
409 MEDIA_IN_USE
  ↓ không còn dùng
soft delete DB
  ↓
xóa object storage bằng job/retry an toàn
  ↓
ghi audit
```

Response: `204 No Content`.

## Quản lý Category

```text
Admin create/update Category
  ↓
validate DTO, normalize/generate slug
  ↓
kiểm tra slug unique và cover MediaAsset hợp lệ
  ↓
ghi DB trong transaction khi cần
  ↓
ghi audit và invalid public cache
```

Response: create `201 CategoryView`; get/update `200 CategoryView`.

Delete/ẩn Category phải kiểm tra artwork đang tham chiếu. Nếu còn relation không được phép, response `409 CATEGORY_IN_USE` hoặc `CATEGORY_VISIBILITY_CONFLICT`. Reorder nhận toàn bộ `orderedIds`, ghi `0..n-1` trong một transaction và trả danh sách canonical.

## Tạo và chỉnh sửa Artwork

```text
POST /api/v1/admin/artworks
  ↓
validate metadata, slug và MediaAsset
  ↓
tạo Artwork ở trạng thái DRAFT
  ↓
201 ArtworkDetailView
  ↓
PUT /:id/categories
  ↓
kiểm tra primaryCategoryId nằm trong categoryIds
  ↓
replace relations trong transaction
  ↓
PUT /:id/images
  ↓
kiểm tra media IDs không trùng và còn hợp lệ
  ↓
replace ảnh, chuẩn hóa sortOrder trong transaction
```

Update trả `200 ArtworkDetailView`. Delete là soft delete và trả `204`.

## Publish/ẩn/lưu trữ Artwork

```text
PATCH /api/v1/admin/artworks/:id/status
  ↓
kiểm tra transition trạng thái hợp lệ
  ↓
nếu publish, kiểm tra:
- title và slug
- primary category visible/chưa xóa
- primary category thuộc categoryIds
- có thumbnail hoặc artwork image hợp lệ
  ↓ thiếu điều kiện
422 ARTWORK_NOT_PUBLISHABLE
  ↓ hợp lệ
cập nhật status/publishedAt/featured theo rule
  ↓
ghi audit và invalid public cache
```

Response: `200 ArtworkDetailView`.

## Cập nhật Profile, Theme và Gallery

```text
Admin request
  ↓
validate field và MediaAsset reference
  ↓
use case cập nhật singleton/child entity
  ↓
reorder trong transaction nếu có
  ↓
Theme update tăng version đúng một
  ↓
ghi audit
  ↓
invalid public cache liên quan
```

Response: create child/gallery `201`; get/update `200`; delete `204`; reorder `200` danh sách canonical.

## Đọc nội dung Public

```text
GET /api/v1/public/...
  ↓
public repository query
  ↓
lọc deletedAt, visibility và Artwork.status = PUBLISHED ngay trong DB
  ↓
map Prisma data sang public view model
  ↓
tạo URL ảnh qua storage adapter
  ↓
trả cache headers/ETag khi được cấu hình
```

Response: `200` public view hoặc paginated list. Draft/hidden/archived/deleted slug trả `404 RESOURCE_NOT_FOUND`, không tiết lộ trạng thái thật.

## Ghi Analytics event

```text
POST /api/v1/public/analytics/events
  ↓
validate eventId, eventType, path, artworkId và occurredAt
  ↓
HMAC anonymousSessionId; không lưu raw ID/IP
  ↓
insert event theo eventId unique
  ↓ trùng eventId
không tăng counter lần hai
  ↓ mới
cập nhật counter/aggregate theo transaction hoặc job idempotent
```

Response: `202 { accepted: true }` cho cả event mới và eventId đã nhận trước đó.

## Ghi Audit

```text
Admin mutation thành công
  ↓
tạo audit record
  ↓
lọc password, token, private key, binary và storage secret
  ↓
lưu actor, action, entity, before/after, requestId, createdAt
```

Response của mutation không cần trả audit record. `GET /api/v1/admin/audit-logs` trả `200` danh sách đã sanitize.

## Background jobs

```text
Scheduler/worker
  ↓
claim một batch có lock
  ↓
aggregate analytics theo ngày
hoặc dọn refresh session/event hết retention
hoặc retry xóa object storage
  ↓
commit checkpoint
  ↓ lỗi
retry có backoff, không xử lý trùng side effect
```

Job không tạo response HTTP. Trạng thái lỗi được log/metric/alert để vận hành xử lý.
