# Backend Flows

Tài liệu mô tả ngắn gọn các luồng chính của backend.

`DATA_MODEL.md` là nguồn chuẩn cho model, quan hệ, ràng buộc dữ liệu và transaction.

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

```text
GET /health/live
  ↓
kiểm tra tiến trình ứng dụng còn hoạt động
  ↓
200
```

```text
GET /health
GET /health/ready
  ↓
kiểm tra readiness của ứng dụng
  ↓
kiểm tra MySQL
  ↓
200 hoặc 503
```

`/health` là alias của `/health/ready`.

## 3. Login

```text
POST /admin/auth/login
  ↓
validate request
  ↓
chuẩn hóa username
  ↓
tìm Admin
  ↓
verify password + trạng thái tài khoản
  ↓
tạo familyId
  ↓
familyExpiresAt = loginAt + 90 ngày
  ↓
tạo refresh token
  ↓
expiresAt = min(now + 7 ngày, familyExpiresAt)
  ↓
lưu RefreshTokenSession
  ↓
tạo access token với sid = RefreshTokenSession.id
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
POST /admin/auth/refresh
  ↓
đọc refresh cookie
  ↓
hash token
  ↓
tìm RefreshTokenSession
  ↓
kiểm tra Admin active
  ↓
kiểm tra revokedAt, expiresAt, familyExpiresAt
```

Nếu token đã rotate hoặc đã revoke bị dùng lại:

```text
reuse detected
  ↓
revoke toàn bộ session chưa revoke trong family
  ↓
xóa refresh cookie
  ↓
401
```

Nếu token hợp lệ:

```text
transaction:
- claim session hiện tại
- revoke session hiện tại với ROTATED
- cập nhật lastUsedAt
- tạo session mới cùng familyId và familyExpiresAt
- expiresAt mới = min(now + 7 ngày, familyExpiresAt)
- gán replacedById
  ↓
tạo refresh token mới
  ↓
tạo access token mới với sid = session mới
  ↓
set refresh cookie mới
  ↓
200
```

Mỗi lần rotation, `sid` thay đổi theo `RefreshTokenSession.id`; `familyId` giữ nguyên trong cùng một login session.

## 5. Gọi Admin API

```text
Request + Bearer access token
  ↓
AuthenticationGuard
  ↓
verify JWT
  ↓
lấy sid
  ↓
kiểm tra RefreshTokenSession theo sid
  ↓
kiểm tra session chưa revoke và chưa hết hạn
  ↓
kiểm tra Admin active
  ↓
PasswordChangeGuard nếu cần
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

Access token gắn với refresh session đã bị revoke hoặc rotate không còn hợp lệ.

## 6. Reload frontend

```text
Frontend reload
  ↓
POST /admin/auth/refresh
  ↓
lưu access token vào memory
  ↓
GET /admin/auth/me
  ↓
dựng auth state
```

Nếu refresh thất bại, frontend chuyển về trạng thái chưa đăng nhập.

## 7. Đổi mật khẩu

```text
PATCH /admin/auth/change-password
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
- revoke mọi refresh session của Admin
  ↓
xóa refresh cookie
  ↓
204
```

Sau khi đổi mật khẩu, người dùng phải đăng nhập lại.

## 8. Logout

```text
POST /admin/auth/logout
  ↓
đọc refresh cookie
  ↓
tìm session
  ↓
revoke toàn bộ family hiện tại với LOGOUT
  ↓
xóa refresh cookie
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
kiểm tra magic bytes, MIME type, dung lượng và kích thước
  ↓
tính SHA-256
  ↓
nếu checksum đã tồn tại
  → trả MediaAsset hiện có
  ↓
lưu original vào object storage
  ↓
tạo thumbnail WebP
  ↓
lưu thumbnail
  ↓
tạo MediaAsset
  ↓
201
```

Nếu có lỗi sau khi đã tạo object trên storage:

```text
cleanup object đã tạo
  ↓
không tạo MediaAsset dở dang
```

MediaAsset là immutable; thay file tạo asset mới.

## 10. Xóa MediaAsset

```text
DELETE /admin/media/:id
  ↓
kiểm tra MediaAsset tồn tại
  ↓
kiểm tra không còn Profile, ArtworkImage hoặc GalleryImage tham chiếu
  ↓
transaction xóa database record
  ↓
204
  ↓
xóa original + thumbnail trên object storage
```

Nếu cleanup storage thất bại:

```text
ghi log
  ↓
retry cleanup
```

Không rollback database chỉ vì thao tác xóa object storage thất bại sau khi transaction đã commit.

## 11. Category

Tạo hoặc cập nhật:

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

Category mới được nối vào cuối danh sách.

Xóa Category:

```text
DELETE Category
  ↓
kiểm tra các Artwork liên quan
  ↓
nếu làm Artwork PUBLISHED mất Category cuối cùng
  → từ chối
  ↓
hard delete Category
  ↓
cascade ArtworkCategory
  ↓
dồn lại position
  ↓
204
```

Các bước làm thay đổi nhiều record phải chạy trong transaction.

## 12. Artwork

Luồng tạo và publish:

```text
tạo Artwork
  ↓
DRAFT
  ↓
gắn Category
  ↓
gắn ArtworkImage
  ↓
kiểm tra điều kiện publish
  ↓
PUBLISHED
```

Điều kiện publish:

```text
title + slug hợp lệ
có ít nhất 1 Category
có ít nhất 1 ArtworkImage
MediaAsset đang gắn tồn tại và có metadata hợp lệ
```

State transition:

```text
DRAFT     → PUBLISHED | ARCHIVED
PUBLISHED → HIDDEN    | ARCHIVED
HIDDEN    → PUBLISHED | DRAFT | ARCHIVED
ARCHIVED  → DRAFT
```

Không cho `ARCHIVED → PUBLISHED` trực tiếp.

Xóa Artwork:

```text
DELETE Artwork
  ↓
nếu status = PUBLISHED
  → từ chối
  ↓
transaction:
- hard delete Artwork
- cascade ArtworkCategory
- cascade ArtworkImage
- AnalyticsEvent.artworkId → null
- dồn lại Artwork.position
  ↓
204
```

Xóa Artwork không tự xóa MediaAsset.

## 13. Gắn Category cho Artwork

```text
PUT /admin/artworks/:id/categories
  ↓
validate toàn bộ danh sách Category
  ↓
kiểm tra ID tồn tại và không trùng
  ↓
transaction:
- thay toàn bộ ArtworkCategory của Artwork
  ↓
200
```

Nếu Artwork đang `PUBLISHED`, danh sách mới không được rỗng.

## 14. Gắn ảnh cho Artwork

```text
PUT /admin/artworks/:id/images
  ↓
validate toàn bộ MediaAsset
  ↓
validate position + altText
  ↓
transaction:
- thay toàn bộ ArtworkImage
- position bắt đầu từ 0
  ↓
200
```

Ảnh có `position = 0` là ảnh chính.

Nếu Artwork đang `PUBLISHED`, danh sách ảnh mới không được rỗng.

## 15. Reorder

Áp dụng cho:

```text
Category
Artwork
ArtworkImage
Skill
SocialLink
GalleryImage
```

Luồng chung:

```text
PUT .../reorder
  ↓
client gửi đầy đủ ID trong scope
  ↓
kiểm tra thiếu / thừa / trùng / sai scope
  ↓
transaction:
- ghi position tạm để tránh unique conflict
- ghi position cuối cùng từ 0..n-1
  ↓
200
```

Sau hard delete, các item đứng sau được dồn position trong cùng transaction.

## 16. Profile

```text
GET/PATCH /admin/profile
  ↓
đọc hoặc update Profile id = "default"
```

Không có API tạo hoặc xóa Profile.

Avatar:

```text
PATCH Profile
  ↓
validate MediaAsset nếu avatarMediaId != null
  ↓
update avatarMediaId
```

MediaAsset đang được dùng làm avatar không được xóa.

## 17. Skill và SocialLink

Tạo:

```text
validate input
  ↓
lấy position cuối
  ↓
insert item mới vào Profile "default"
```

Tạo item và xác định position phải an toàn trước race condition.

Reorder dùng luồng chung tại mục 15.

Hard delete:

```text
xóa item
  ↓
dồn position
  ↓
204
```

## 18. Gallery

Thêm ảnh:

```text
POST /admin/gallery-images
  ↓
validate MediaAsset
  ↓
kiểm tra MediaAsset chưa có trong Gallery
  ↓
thêm GalleryImage ở cuối
  ↓
201
```

Xóa:

```text
DELETE GalleryImage
  ↓
hard delete row GalleryImage
  ↓
dồn position
  ↓
204
```

Không tự xóa MediaAsset.

## 19. Public API

```text
GET /public/...
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

Artwork public chỉ trả record có `status = PUBLISHED`.

Featured artwork phải đồng thời:

```text
status = PUBLISHED
isFeatured = true
```

Không trả field nội bộ.

## 20. Analytics event

```text
POST /public/analytics/events
  ↓
validate eventId
  ↓
validate eventType
  ↓
validate occurredAt
  ↓
validate artworkId theo eventType
  ↓
insert AnalyticsEvent
  ↓
202
```

Quy tắc:

```text
SITE_VIEW
→ artworkId = null

ARTWORK_VIEW
→ artworkId phải trỏ tới Artwork đang tồn tại
```

`occurredAt`:

```text
không cũ hơn 24 giờ
không vượt quá thời gian server 5 phút
```

Nếu `eventId` đã tồn tại:

```text
không tạo thêm record
không tăng thống kê lần hai
```

Không có bước ghi bảng aggregate trong phiên bản đầu tiên.

## 21. Dashboard và Analytics query

```text
GET /admin/dashboard/summary
GET /admin/analytics/...
  ↓
validate date range
  ↓
Repository query dữ liệu hiện có + raw AnalyticsEvent
  ↓
Service tổng hợp kết quả
  ↓
200
```

Date range tối đa 366 ngày.

Không có bảng Dashboard, counter hoặc aggregate/cache riêng trong phiên bản đầu tiên.

## 22. Cleanup RefreshTokenSession

```text
background job
  ↓
tìm session đã hết hạn hoặc revoke
  ↓
chỉ chọn session có familyExpiresAt đã qua ít nhất 7 ngày
  ↓
hard delete theo batch
```

Session phải được giữ đủ thời gian phục vụ reuse detection trước khi cleanup.

## 23. Cleanup AnalyticsEvent

```text
background job
  ↓
tìm AnalyticsEvent quá 400 ngày
  ↓
hard delete theo batch
```

Job phải có thể chạy lại mà không tạo side effect sai.

## 24. Đối soát object storage

```text
background job
  ↓
quét object cần đối soát
  ↓
đối chiếu storageKey với MediaAsset
  ↓
xóa object mồ côi
```

Cleanup phải idempotent và có retry/backoff khi lỗi.

## 25. Nguyên tắc transaction

Phải dùng transaction khi một nghiệp vụ thay đổi nhiều record và không được phép dở dang.

Các trường hợp chính:

```text
refresh token rotation
revoke nhiều refresh session
change password
hard delete có cascade hoặc dồn position
thay Category của Artwork
thay ArtworkImage
reorder
insert item cần xác định position cuối
```

Object storage không nằm trong transaction MySQL.

## 26. Công thức luồng chuẩn

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

Controller xử lý HTTP, Service xử lý nghiệp vụ, Repository xử lý database.
