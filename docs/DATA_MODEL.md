# Data Model

Tài liệu này là nguồn quyết định nghiệp vụ để viết `prisma/schema.prisma` và migration đầu tiên.

Mọi quyết định cần thiết cho schema ban đầu đã được chốt trong tài liệu này. Nếu thay đổi mô hình sau khi migration đầu tiên đã chạy, phải tạo migration mới; không sửa migration cũ.

## 1. Quy ước chung

- Database: MySQL 8+.
- ORM và migration: Prisma 7.
- Tên model và field trong Prisma dùng `PascalCase` và `camelCase`.
- ID của entity dùng UUID v4, lưu bằng `CHAR(36)` và trả qua API dưới dạng `string`.
- Ngoại lệ: `Profile.id` dùng khóa cố định `"default"`; `AnalyticsEvent.eventId` là khóa chính do client tạo.
- Timestamp lưu theo UTC bằng `DATETIME(3)`; API trả RFC 3339 UTC.
- `createdAt` do database tạo, `updatedAt` tự cập nhật khi record thay đổi.
- Database dùng charset `utf8mb4` và collation `utf8mb4_0900_ai_ci`. Giá trị cần unique phải được trim và chuẩn hóa trước khi ghi.
- Không dùng soft delete và không có field `deletedAt` trong bất kỳ model nào.
- `DELETE` là hard delete, không có chức năng restore. API trả `204 No Content` sau khi xóa thành công.
- Các quan hệ luôn có foreign key thật trong database; hành vi `CASCADE`, `RESTRICT` hoặc `SET NULL` được quy định ở mục 15.
- Các thao tác reorder và mutation ảnh hưởng nhiều record phải chạy trong transaction.
- `Dashboard` là dữ liệu tổng hợp, không phải model và không có bảng riêng.

## 2. Enum

### 2.1. AdminRole

```text
OWNER
EDITOR
```

- `OWNER`: toàn quyền quản trị.
- `EDITOR`: quản lý nội dung, không quản lý tài khoản quản trị.
- Admin đầu tiên được seed với role `OWNER`.

### 2.2. RefreshTokenRevokedReason

```text
ROTATED
LOGOUT
PASSWORD_CHANGED
REUSE_DETECTED
ADMIN_DISABLED
```

`revokedAt` và `revokedReason` thể hiện trạng thái bảo mật của token, không phải soft delete.

### 2.3. ArtworkStatus

```text
DRAFT
PUBLISHED
HIDDEN
ARCHIVED
```

`ARCHIVED` là trạng thái vòng đời của nội dung, không phải trạng thái đã xóa. Record chỉ bị xóa khi gọi hard delete.

### 2.4. AnalyticsEventType

```text
SITE_VIEW
ARTWORK_VIEW
```

Chỉ bổ sung event type khi có consumer và báo cáo sử dụng dữ liệu đó.

## 3. AdminUser

Đại diện tài khoản quản trị viên.

| Field | Kiểu database | Null | Mặc định | Ràng buộc |
|---|---|---:|---|---|
| `id` | `CHAR(36)` | Không | UUID v4 | Primary key |
| `username` | `VARCHAR(50)` | Không | — | Unique |
| `passwordHash` | `VARCHAR(255)` | Không | — | — |
| `role` | `ENUM` | Không | `EDITOR` | `AdminRole` |
| `isActive` | `BOOLEAN` | Không | `true` | — |
| `mustChangePassword` | `BOOLEAN` | Không | `true` | — |
| `createdAt` | `DATETIME(3)` | Không | `now()` | — |
| `updatedAt` | `DATETIME(3)` | Không | — | Auto update |

Quy tắc:

- Không có API đăng ký public.
- `username` được trim, chuyển lowercase và không được thay đổi sau khi tạo.
- `username` chỉ gồm chữ cái Latin lowercase, chữ số, dấu chấm, gạch dưới hoặc gạch ngang; dài từ 3 đến 50 ký tự.
- `passwordHash` lưu Argon2id hash; không lưu mật khẩu thô.
- Không được vô hiệu hóa hoặc hạ quyền `OWNER` cuối cùng đang active.
- Khi `isActive` chuyển thành `false`, toàn bộ refresh token family của admin phải bị revoke.
- Không cung cấp API hard delete `AdminUser` trong phiên bản đầu tiên.

Quan hệ:

```text
AdminUser 1 ─── N RefreshTokenSession
```

## 4. RefreshTokenSession

Đại diện một refresh token cụ thể trong chuỗi rotation.

| Field | Kiểu database | Null | Mặc định | Ràng buộc |
|---|---|---:|---|---|
| `id` | `CHAR(36)` | Không | UUID v4 | Primary key |
| `adminUserId` | `CHAR(36)` | Không | — | Foreign key |
| `tokenHash` | `CHAR(64)` | Không | — | Unique, SHA-256 hex |
| `familyId` | `CHAR(36)` | Không | — | Index |
| `familyExpiresAt` | `DATETIME(3)` | Không | — | Index |
| `expiresAt` | `DATETIME(3)` | Không | — | Index |
| `revokedAt` | `DATETIME(3)` | Có | `null` | — |
| `revokedReason` | `ENUM` | Có | `null` | `RefreshTokenRevokedReason` |
| `replacedById` | `CHAR(36)` | Có | `null` | Unique, self foreign key |
| `lastUsedAt` | `DATETIME(3)` | Có | `null` | — |
| `createdAt` | `DATETIME(3)` | Không | `now()` | — |

Quy tắc:

- Database chỉ lưu SHA-256 hash của refresh token; raw token chỉ tồn tại ở cookie phía client.
- `id` là session ID và được đưa vào access token qua claim `sid`.
- Khi login, tạo `familyId` mới và đặt `familyExpiresAt = loginAt + 90 ngày`.
- Idle TTL là 7 ngày. Khi tạo hoặc rotate token, `expiresAt = min(now + 7 ngày, familyExpiresAt)`.
- Mỗi lần refresh thành công phải chạy trong transaction: khóa session hiện tại, tạo session kế tiếp cùng `familyId`, đặt `lastUsedAt`, revoke session hiện tại với lý do `ROTATED`, rồi gán `replacedById`.
- Session hợp lệ khi admin active, chưa revoke, `expiresAt > now` và `familyExpiresAt > now`.
- Dùng lại token đã rotate hoặc revoke phải revoke mọi session chưa revoke trong cùng family với lý do `REUSE_DETECTED`.
- Logout revoke toàn bộ family hiện tại; đổi mật khẩu hoặc vô hiệu hóa admin revoke toàn bộ family của admin.
- Session đã hết hạn hoặc đã revoke vẫn được giữ đến khi `familyExpiresAt` qua 7 ngày để phục vụ reuse detection, sau đó background cleanup hard delete.
- Cặp `revokedAt` và `revokedReason` phải cùng null hoặc cùng có giá trị.

Index bổ sung:

```text
(adminUserId, familyId)
(adminUserId, revokedAt)
```

## 5. Category

Đại diện danh mục tác phẩm.

| Field | Kiểu database | Null | Mặc định | Ràng buộc |
|---|---|---:|---|---|
| `id` | `CHAR(36)` | Không | UUID v4 | Primary key |
| `name` | `VARCHAR(100)` | Không | — | — |
| `slug` | `VARCHAR(120)` | Không | — | Unique |
| `description` | `TEXT` | Có | `null` | — |
| `position` | `INT UNSIGNED` | Không | — | Unique |
| `createdAt` | `DATETIME(3)` | Không | `now()` | — |
| `updatedAt` | `DATETIME(3)` | Không | — | Auto update |

Quy tắc:

- `slug` dùng trong Public API, được chuẩn hóa lowercase theo định dạng kebab-case.
- Không có `isActive`; category tồn tại thì được phép trả public.
- Category mới được nối vào cuối danh sách.
- Một Artwork có thể thuộc nhiều Category và không có primary category.
- Không được hard delete Category nếu thao tác đó làm một Artwork đang `PUBLISHED` không còn Category nào. Phải gán category khác hoặc đổi trạng thái Artwork trước.
- Sau khi hard delete, `slug` được phép dùng lại.

Quan hệ:

```text
Category N ─── N Artwork qua ArtworkCategory
```

## 6. Artwork

Đại diện một tác phẩm.

| Field | Kiểu database | Null | Mặc định | Ràng buộc |
|---|---|---:|---|---|
| `id` | `CHAR(36)` | Không | UUID v4 | Primary key |
| `title` | `VARCHAR(160)` | Không | — | — |
| `slug` | `VARCHAR(180)` | Không | — | Unique |
| `description` | `TEXT` | Có | `null` | — |
| `status` | `ENUM` | Không | `DRAFT` | `ArtworkStatus`, index |
| `isFeatured` | `BOOLEAN` | Không | `false` | Index |
| `position` | `INT UNSIGNED` | Không | — | Unique |
| `publishedAt` | `DATETIME(3)` | Có | `null` | Index |
| `createdAt` | `DATETIME(3)` | Không | `now()` | — |
| `updatedAt` | `DATETIME(3)` | Không | — | Auto update |

Quy tắc:

- Artwork mới có trạng thái `DRAFT` và được nối vào cuối danh sách.
- `slug` dùng trong Public API, được chuẩn hóa lowercase theo định dạng kebab-case.
- Public API chỉ trả Artwork có `status = PUBLISHED`.
- `isFeatured` chỉ có hiệu lực với Artwork đang `PUBLISHED`; query public luôn lọc cả hai điều kiện.
- Artwork không có primary category riêng.
- Artwork có nhiều ảnh; ảnh có `position = 0` là ảnh chính.
- `publishedAt` ghi thời điểm publish lần đầu và không bị xóa khi chuyển sang `HIDDEN` hoặc `ARCHIVED`.
- Chỉ được hard delete Artwork khi trạng thái khác `PUBLISHED`. Xóa Artwork sẽ xóa các row liên kết nhưng không tự xóa `MediaAsset`.
- Sau khi hard delete, `slug` được phép dùng lại.

Điều kiện chuyển sang `PUBLISHED`:

- `title` và `slug` hợp lệ.
- Có ít nhất một Category.
- Có ít nhất một ArtworkImage.
- Tất cả MediaAsset đang gắn vẫn tồn tại và có metadata ảnh hợp lệ.

State transition hợp lệ:

```text
DRAFT     → PUBLISHED | ARCHIVED
PUBLISHED → HIDDEN    | ARCHIVED
HIDDEN    → PUBLISHED | DRAFT | ARCHIVED
ARCHIVED  → DRAFT
```

Không cho phép chuyển trực tiếp `ARCHIVED → PUBLISHED`; phải đưa về `DRAFT` để kiểm tra lại điều kiện publish.

## 7. ArtworkCategory

Bảng liên kết Artwork và Category.

| Field | Kiểu database | Null | Ràng buộc |
|---|---|---:|---|
| `artworkId` | `CHAR(36)` | Không | Foreign key |
| `categoryId` | `CHAR(36)` | Không | Foreign key |

Ràng buộc:

- Primary key tổng hợp: `(artworkId, categoryId)`.
- Index đảo chiều: `(categoryId, artworkId)` để lọc Artwork theo Category.
- Không có `id`, `position` hoặc `isPrimary` vì các field này không có nghiệp vụ sử dụng.
- Thứ tự Category của một Artwork lấy theo `Category.position`.
- Thay toàn bộ category của Artwork phải validate đầy đủ rồi cập nhật trong một transaction.

## 8. MediaAsset

Đại diện một ảnh đã upload và metadata của file trên object storage.

| Field | Kiểu database | Null | Mặc định | Ràng buộc |
|---|---|---:|---|---|
| `id` | `CHAR(36)` | Không | UUID v4 | Primary key |
| `storageKey` | `VARCHAR(512)` | Không | — | Unique |
| `thumbnailStorageKey` | `VARCHAR(512)` | Có | `null` | Unique |
| `originalName` | `VARCHAR(255)` | Không | — | — |
| `mimeType` | `VARCHAR(100)` | Không | — | — |
| `sizeBytes` | `INT UNSIGNED` | Không | — | — |
| `width` | `INT UNSIGNED` | Không | — | — |
| `height` | `INT UNSIGNED` | Không | — | — |
| `checksumSha256` | `CHAR(64)` | Không | — | Unique |
| `createdAt` | `DATETIME(3)` | Không | `now()` | — |

Quy tắc:

- MediaAsset là immutable; thay ảnh tạo asset mới nên không cần `updatedAt`.
- `storageKey` là khóa độc lập với storage provider, không lưu public URL cố định.
- Một MediaAsset có thể được tái sử dụng ở nhiều Artwork và ở Gallery/Profile.
- Upload hỗ trợ `image/jpeg`, `image/png` và `image/webp`; giới hạn 10 MiB/file và tối đa 12.000 × 12.000 pixel.
- Không nhận SVG hoặc file ảnh động trong phiên bản đầu tiên.
- Server phải kiểm tra magic bytes, MIME type, dung lượng, kích thước, tính hợp lệ của ảnh và SHA-256 trước khi ghi record.
- Thumbnail WebP được tạo trong luồng upload và lưu qua `thumbnailStorageKey`. Nếu không tạo được thumbnail thì toàn bộ upload thất bại và cleanup object đã tạo.
- `checksumSha256` unique để tránh lưu trùng nội dung. Upload trùng trả lại asset đã có thay vì tạo row mới.
- Chỉ được hard delete MediaAsset khi không còn Profile, ArtworkImage hoặc GalleryImage tham chiếu.
- Xóa database record trước, sau đó xóa original và thumbnail trên storage bằng thao tác idempotent. Nếu xóa storage thất bại, ghi log và retry cleanup; job đối soát định kỳ phải xóa object không còn `storageKey` tương ứng trong database.

## 9. ArtworkImage

Liên kết Artwork với MediaAsset và lưu metadata theo ngữ cảnh Artwork.

| Field | Kiểu database | Null | Ràng buộc |
|---|---|---:|---|
| `artworkId` | `CHAR(36)` | Không | Foreign key |
| `mediaAssetId` | `CHAR(36)` | Không | Foreign key |
| `position` | `INT UNSIGNED` | Không | — |
| `altText` | `VARCHAR(255)` | Có | — |

Ràng buộc và quy tắc:

- Primary key tổng hợp: `(artworkId, mediaAssetId)`; cùng một ảnh không lặp lại trong một Artwork.
- Unique tổng hợp: `(artworkId, position)`.
- Index: `(mediaAssetId)` để kiểm tra asset đang được dùng.
- Ảnh có `position = 0` là ảnh chính; không có field `isPrimary`.
- `altText` thuộc ngữ cảnh hiển thị nên nằm ở bảng liên kết, không nằm trong MediaAsset.
- Không được bỏ ảnh cuối cùng khỏi Artwork đang `PUBLISHED`. Phải thêm ảnh thay thế hoặc đổi trạng thái trước.
- Thay danh sách ảnh và reorder phải chạy trong transaction.

Quan hệ:

```text
Artwork 1 ─── N ArtworkImage N ─── 1 MediaAsset
```

## 10. Profile

Hồ sơ public duy nhất của website.

| Field | Kiểu database | Null | Mặc định | Ràng buộc |
|---|---|---:|---|---|
| `id` | `VARCHAR(20)` | Không | `"default"` | Primary key, phải bằng `"default"` |
| `name` | `VARCHAR(120)` | Không | — | — |
| `bio` | `TEXT` | Có | `null` | — |
| `avatarMediaId` | `CHAR(36)` | Có | `null` | Foreign key, index |
| `createdAt` | `DATETIME(3)` | Không | `now()` | — |
| `updatedAt` | `DATETIME(3)` | Không | — | Auto update |

Quy tắc:

- Seed luôn tạo đúng một record có `id = "default"`.
- Service chỉ đọc và update record này; không có API tạo hoặc xóa Profile.
- Migration thêm `CHECK (id = 'default')` để database không thể chứa Profile thứ hai.
- `avatarMediaId` có thể null; MediaAsset đang làm avatar không được xóa cho đến khi bỏ tham chiếu.

Quan hệ:

```text
Profile 1 ─── N Skill
Profile 1 ─── N SocialLink
Profile N ─── 1 MediaAsset (avatar, optional)
```

## 11. Skill

Kỹ năng thuộc Profile mặc định.

| Field | Kiểu database | Null | Mặc định | Ràng buộc |
|---|---|---:|---|---|
| `id` | `CHAR(36)` | Không | UUID v4 | Primary key |
| `profileId` | `VARCHAR(20)` | Không | `"default"` | Foreign key |
| `name` | `VARCHAR(100)` | Không | — | — |
| `position` | `INT UNSIGNED` | Không | — | — |
| `createdAt` | `DATETIME(3)` | Không | `now()` | — |
| `updatedAt` | `DATETIME(3)` | Không | — | Auto update |

Ràng buộc:

- Unique tổng hợp: `(profileId, name)`.
- Unique tổng hợp: `(profileId, position)`.
- `name` được trim; không cho phép chuỗi rỗng.
- Skill mới được nối vào cuối danh sách.

## 12. SocialLink

Liên kết mạng xã hội thuộc Profile mặc định.

| Field | Kiểu database | Null | Mặc định | Ràng buộc |
|---|---|---:|---|---|
| `id` | `CHAR(36)` | Không | UUID v4 | Primary key |
| `profileId` | `VARCHAR(20)` | Không | `"default"` | Foreign key |
| `platform` | `VARCHAR(50)` | Không | — | — |
| `url` | `VARCHAR(2048)` | Không | — | — |
| `position` | `INT UNSIGNED` | Không | — | — |
| `createdAt` | `DATETIME(3)` | Không | `now()` | — |
| `updatedAt` | `DATETIME(3)` | Không | — | Auto update |

Ràng buộc và quy tắc:

- `platform` là string lowercase thay vì enum để thêm nền tảng mới mà không cần migration.
- Unique tổng hợp: `(profileId, platform)`; mỗi platform chỉ có một link.
- Unique tổng hợp: `(profileId, position)`.
- `url` phải là URL tuyệt đối dùng `https`; chỉ cho `http` ở môi trường development nếu có cấu hình rõ ràng.
- SocialLink mới được nối vào cuối danh sách.

## 13. GalleryImage

Ảnh hiển thị trong gallery độc lập với danh sách Artwork.

| Field | Kiểu database | Null | Mặc định | Ràng buộc |
|---|---|---:|---|---|
| `id` | `CHAR(36)` | Không | UUID v4 | Primary key |
| `mediaAssetId` | `CHAR(36)` | Không | — | Foreign key, unique |
| `altText` | `VARCHAR(255)` | Có | `null` | — |
| `caption` | `VARCHAR(500)` | Có | `null` | — |
| `position` | `INT UNSIGNED` | Không | — | Unique |
| `createdAt` | `DATETIME(3)` | Không | `now()` | — |
| `updatedAt` | `DATETIME(3)` | Không | — | Auto update |

Quy tắc:

- Một MediaAsset chỉ xuất hiện một lần trong Gallery.
- GalleryImage mới được nối vào cuối danh sách.
- Hard delete GalleryImage chỉ xóa row liên kết, không tự xóa MediaAsset.

Quan hệ:

```text
GalleryImage N ─── 1 MediaAsset
```

## 14. AnalyticsEvent

Lưu raw analytics event ẩn danh và chống ghi trùng.

| Field | Kiểu database | Null | Mặc định | Ràng buộc |
|---|---|---:|---|---|
| `eventId` | `CHAR(36)` | Không | — | Primary key, UUID do client tạo |
| `eventType` | `ENUM` | Không | — | `AnalyticsEventType` |
| `artworkId` | `CHAR(36)` | Có | `null` | Foreign key, index |
| `occurredAt` | `DATETIME(3)` | Không | — | Index |
| `createdAt` | `DATETIME(3)` | Không | `now()` | Index |

Quy tắc:

- `eventId` làm primary key để insert cùng event lần hai không tạo thêm dữ liệu hoặc tăng thống kê.
- `SITE_VIEW` bắt buộc có `artworkId = null`.
- `ARTWORK_VIEW` bắt buộc có `artworkId` trỏ tới Artwork đang tồn tại tại thời điểm nhận event.
- Không lưu payload tùy ý. Hai loại event hiện tại chỉ cần `eventType`, `artworkId` và thời gian xảy ra.
- Không lưu IP, user-agent đầy đủ, cookie, fingerprint, email hoặc dữ liệu nhận diện người dùng trong AnalyticsEvent.
- Chấp nhận `occurredAt` không cũ hơn 24 giờ và không vượt quá thời gian server 5 phút.
- Không tạo bảng aggregate trong phiên bản đầu tiên; dashboard tổng hợp trực tiếp từ raw event.
- Raw event được giữ 400 ngày để bao phủ báo cáo tối đa 366 ngày, sau đó background cleanup hard delete theo batch.

Index bổ sung:

```text
(eventType, occurredAt)
(artworkId, occurredAt)
```

Nếu Artwork bị hard delete, `artworkId` của event cũ được đặt `null`; event vẫn được giữ cho thống kê tổng quan.

## 15. Quan hệ và hành vi khi hard delete

| Parent | Child/reference | `onDelete` | Lý do |
|---|---|---|---|
| `AdminUser` | `RefreshTokenSession.adminUserId` | `CASCADE` | Không giữ token mồ côi khi maintenance xóa admin |
| `RefreshTokenSession` | `RefreshTokenSession.replacedById` | `SET NULL` | Cleanup session không chặn session khác |
| `Artwork` | `ArtworkCategory.artworkId` | `CASCADE` | Bảng liên kết không có vòng đời độc lập |
| `Category` | `ArtworkCategory.categoryId` | `CASCADE` | Bảng liên kết không có vòng đời độc lập |
| `Artwork` | `ArtworkImage.artworkId` | `CASCADE` | Bảng liên kết không có vòng đời độc lập |
| `MediaAsset` | `ArtworkImage.mediaAssetId` | `RESTRICT` | Không để Artwork trỏ tới file đã xóa |
| `MediaAsset` | `Profile.avatarMediaId` | `RESTRICT` | Phải bỏ avatar trước khi xóa file |
| `Profile` | `Skill.profileId` | `CASCADE` | Dữ liệu con không có vòng đời độc lập |
| `Profile` | `SocialLink.profileId` | `CASCADE` | Dữ liệu con không có vòng đời độc lập |
| `MediaAsset` | `GalleryImage.mediaAssetId` | `RESTRICT` | Phải xóa GalleryImage trước khi xóa file |
| `Artwork` | `AnalyticsEvent.artworkId` | `SET NULL` | Giữ số liệu tổng quan sau khi xóa Artwork |

Mọi hard delete có cascade hoặc kiểm tra điều kiện nghiệp vụ phải chạy trong transaction. Việc xóa object trên storage diễn ra sau khi transaction database commit vì database và object storage không dùng chung transaction.

## 16. Quy tắc reorder

Các model có reorder:

```text
Category
Artwork
ArtworkImage
Skill
SocialLink
GalleryImage
```

Phạm vi position:

| Model | Scope |
|---|---|
| `Category` | Toàn bộ Category |
| `Artwork` | Toàn bộ Artwork |
| `ArtworkImage` | Trong một Artwork |
| `Skill` | Trong một Profile |
| `SocialLink` | Trong một Profile |
| `GalleryImage` | Toàn bộ Gallery |

Quy tắc chung:

- `position` bắt đầu từ `0`, liên tục và không có khoảng trống trong từng scope.
- Item mới được thêm ở cuối với `position = số lượng item hiện tại`; thao tác lấy position và insert phải cùng transaction, có khóa phù hợp hoặc retry khi xung đột unique.
- Client gửi đầy đủ danh sách ID trong scope theo thứ tự mong muốn.
- Server từ chối danh sách thiếu ID, thừa ID, trùng ID hoặc chứa ID ngoài scope.
- Reorder cập nhật toàn bộ scope trong một transaction.
- Do database có unique constraint trên position, repository phải dùng chiến lược giá trị tạm không xung đột trước khi ghi position cuối cùng.
- Sau hard delete, các item đứng sau được dồn position để danh sách vẫn liên tục.

## 17. Sơ đồ quan hệ tổng quát

```text
AdminUser
   └──< RefreshTokenSession

Profile (id = "default")
   ├──< Skill
   ├──< SocialLink
   └──── MediaAsset (avatar, optional)

Artwork 1 ─── N ArtworkCategory N ─── 1 Category

Artwork
   └──< ArtworkImage >── MediaAsset

GalleryImage >── MediaAsset

Artwork
   └──< AnalyticsEvent (optional reference)
```

## 18. Dữ liệu không có bảng riêng

Dashboard được tính từ:

```text
Artwork
Category
MediaAsset
AnalyticsEvent
```

Không tạo bảng counter, aggregate hoặc cache trong migration đầu tiên. Chỉ bổ sung khi metric thực tế cho thấy query trực tiếp không đáp ứng được hiệu năng.

## 19. Checklist trước migration đầu tiên

- [x] ID dùng UUID v4; Profile dùng khóa logic `default`.
- [x] Không dùng soft delete và không có `deletedAt`.
- [x] Slug unique toàn cục trong dữ liệu đang tồn tại.
- [x] Artwork không có primary category.
- [x] Ảnh đầu tiên (`position = 0`) là ảnh chính.
- [x] MediaAsset lưu một thumbnail qua `thumbnailStorageKey`.
- [x] Position bắt đầu từ `0` và unique theo scope.
- [x] Điều kiện publish và state transition đã chốt.
- [x] Refresh token có idle TTL 7 ngày và absolute TTL 90 ngày.
- [x] Profile singleton được seed và bảo vệ bằng check constraint.
- [x] Analytics raw event giữ 400 ngày và không có bảng aggregate ban đầu.
- [x] Foreign key và referential action đã chốt.
