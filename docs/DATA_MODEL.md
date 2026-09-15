# Data Model

Tài liệu này khóa mô hình dữ liệu nghiệp vụ ở mức khái niệm trước khi viết `schema.prisma`.

`schema.prisma` sẽ là mô tả kỹ thuật chi tiết của database sau khi các quyết định trong file này được chốt.

## 1. Quy ước chung

- Database: MySQL 8+.
- ORM và migration: Prisma 7.
- ID ở API dùng `string`.
- Kiểu sinh ID cụ thể (`UUID`, `ULID`, `CUID`...) **CHƯA CHỐT**.
- Timestamp lưu theo UTC.
- Soft delete chỉ áp dụng cho entity có yêu cầu nghiệp vụ tương ứng.
- Các trường `position` dùng để phục vụ reorder phải có quy tắc cập nhật trong transaction.
- Profile và Theme là singleton có khóa logic `default`.

## 2. AdminUser

Đại diện tài khoản quản trị viên.

Các dữ liệu chính:

```text
id
username
passwordHash
role
isActive
mustChangePassword
createdAt
updatedAt
```

Quy tắc:

- Không có API đăng ký public.
- Admin đầu tiên được tạo bằng seed.
- `username` phải unique.
- `passwordHash` dùng Argon2id.
- Một Admin có nhiều refresh session.

Quan hệ:

```text
AdminUser 1 ─── N RefreshTokenSession
```

## 3. RefreshTokenSession

Đại diện một refresh token cụ thể trong chuỗi rotation.

Các dữ liệu chính:

```text
id
adminUserId
tokenHash
familyId
fingerprintHash
expiresAt
revokedAt
revokedReason
replacedById
lastUsedAt
createdAt
```

Quy tắc:

- Database chỉ lưu SHA-256 hash của refresh token.
- Raw refresh token không được lưu trong database.
- `id` là session ID hiện tại và được đưa vào access token qua claim `sid`.
- Mỗi lần refresh thành công tạo session mới.
- Session mới giữ cùng `familyId`.
- Session cũ được revoke và trỏ tới session thay thế bằng `replacedById`.
- Reuse token đã rotate phải có thể được phát hiện.
- Reuse theo policy hiện tại có thể revoke toàn bộ family.
- Idle TTL mục tiêu: 7 ngày.
- Absolute session TTL mục tiêu: tối đa 90 ngày tính từ lần login đầu tiên.

Quan hệ:

```text
AdminUser 1 ─── N RefreshTokenSession

RefreshTokenSession
    └── familyId
        └── nhóm các session thuộc cùng một lần login
```

Cần chốt thêm khi viết schema:

- Cách lưu mốc absolute expiry của family.
- Có cần bảng riêng cho login session/token family hay không.

## 4. Category

Đại diện danh mục tác phẩm.

Các dữ liệu chính dự kiến:

```text
id
name
slug
description
position
createdAt
updatedAt
deletedAt
```

Quy tắc:

- `slug` dùng cho Public API.
- Có reorder.
- Có soft delete.
- Public API không trả category đã deleted.

Quan hệ:

```text
Category N ─── N Artwork
```

Cần chốt:

- Quy tắc unique của `slug` khi soft delete.
- Có `isActive` riêng hay chỉ dùng soft delete.
- Artwork có cần một primary category hay không.

## 5. Artwork

Đại diện một tác phẩm.

Các dữ liệu chính dự kiến:

```text
id
title
slug
description
status
isFeatured
position
createdAt
updatedAt
deletedAt
publishedAt
```

Artwork status:

```text
DRAFT
PUBLISHED
HIDDEN
ARCHIVED
```

Quy tắc:

- Tạo mới mặc định ở trạng thái `DRAFT`.
- Public API chỉ trả dữ liệu được phép public.
- Có reorder.
- Có soft delete.
- Có thể gắn nhiều Category.
- Có thể gắn nhiều Media.
- Publish chỉ thành công khi đủ dữ liệu bắt buộc.

Quan hệ:

```text
Artwork N ─── N Category
Artwork 1 ─── N ArtworkImage
```

Cần chốt:

- Điều kiện cụ thể để chuyển sang `PUBLISHED`.
- Quy tắc chuyển trạng thái hợp lệ.
- Quy tắc unique của `slug` khi soft delete.
- Có cần primary image riêng hay dùng thứ tự ảnh.
- Có cần primary category hay không.

## 6. ArtworkCategory

Bảng liên kết Artwork và Category.

Dữ liệu chính dự kiến:

```text
artworkId
categoryId
position
```

Quy tắc:

- Một cặp `artworkId + categoryId` không được trùng.
- Nếu cần thứ tự category trong một artwork thì dùng `position`.

Cần chốt:

- Có cần `isPrimary` hay không.

## 7. MediaAsset

Đại diện file media đã upload.

Các dữ liệu chính dự kiến:

```text
id
storageKey
originalName
mimeType
size
width
height
checksum
createdAt
updatedAt
deletedAt
```

Quy tắc:

- File phải được validate trước khi lưu chính thức.
- Có checksum.
- Có metadata ảnh.
- Có soft delete.
- Nếu lưu storage thành công nhưng ghi database thất bại phải cleanup object đã tạo.

Cần chốt:

- Giới hạn dung lượng upload.
- MIME type/định dạng được phép.
- Thumbnail/derivative lưu trong cùng bảng hay bảng riêng.
- Storage provider cụ thể.
- Chính sách xóa file vật lý sau soft delete.

## 8. ArtworkImage

Liên kết Artwork với MediaAsset.

Dữ liệu chính dự kiến:

```text
id
artworkId
mediaAssetId
position
```

Quy tắc:

- Một Artwork có nhiều ảnh.
- `position` quyết định thứ tự ảnh.
- Reorder phải được thực hiện trong transaction.

Quan hệ:

```text
Artwork 1 ─── N ArtworkImage
MediaAsset 1 ─── N ArtworkImage
```

Cần chốt:

- Có cho một MediaAsset được dùng bởi nhiều Artwork hay không.
- Có cần `isPrimary` hay ảnh đầu tiên là ảnh chính.

## 9. Profile

Hồ sơ public của website.

Profile là singleton:

```text
key = "default"
```

Các dữ liệu chính dự kiến:

```text
id
key
name
bio
avatarMediaId
createdAt
updatedAt
```

Quy tắc:

- Chỉ có một Profile mặc định.
- Database phải có unique constraint để bảo đảm singleton.

Quan hệ:

```text
Profile 1 ─── N Skill
Profile 1 ─── N SocialLink
```

Cần chốt:

- Các field profile cụ thể theo giao diện frontend.

## 10. Skill

Kỹ năng thuộc Profile.

Các dữ liệu chính dự kiến:

```text
id
profileId
name
position
createdAt
updatedAt
```

Quy tắc:

- Có reorder.
- Thuộc Profile mặc định.

## 11. SocialLink

Liên kết mạng xã hội thuộc Profile.

Các dữ liệu chính dự kiến:

```text
id
profileId
platform
url
position
createdAt
updatedAt
```

Quy tắc:

- Có reorder.
- Thuộc Profile mặc định.

Cần chốt:

- `platform` dùng enum cố định hay string.
- Có cho nhiều link cùng platform hay không.

## 12. Theme

Cấu hình giao diện website.

Theme là singleton:

```text
key = "default"
```

Các dữ liệu chính phụ thuộc giao diện frontend.

Tối thiểu:

```text
id
key
createdAt
updatedAt
```

Quy tắc:

- Chỉ có một Theme mặc định.
- Database phải có unique constraint trên `key`.

Cần chốt:

- Danh sách field theme cụ thể.

## 13. GalleryImage

Ảnh hiển thị trong gallery.

Các dữ liệu chính dự kiến:

```text
id
mediaAssetId
position
createdAt
updatedAt
deletedAt
```

Quy tắc:

- Có reorder.
- Có soft delete.
- Public API không trả item đã deleted.

Quan hệ:

```text
MediaAsset 1 ─── N GalleryImage
```

Cần chốt:

- Có cho cùng MediaAsset xuất hiện nhiều lần trong Gallery hay không.

## 14. AuditLog

Ghi lại các thao tác quản trị quan trọng.

Các dữ liệu chính dự kiến:

```text
id
adminUserId
action
resourceType
resourceId
metadata
createdAt
```

Quy tắc:

- Chỉ ghi audit sau mutation cần theo dõi.
- Không ghi password, token, private key hoặc secret.
- Audit cần đủ dữ liệu để biết ai đã làm gì và với resource nào.

Cần chốt:

- Audit phải nằm cùng transaction với mutation hay cho phép eventual consistency.
- Thời gian retention.
- Có lưu before/after snapshot hay chỉ metadata thay đổi.

## 15. AnalyticsEvent

Lưu event analytics ẩn danh.

Các dữ liệu chính dự kiến:

```text
id
eventId
eventType
artworkId
metadata
occurredAt
createdAt
```

Quy tắc:

- `eventId` dùng để chống ghi trùng.
- Event trùng không được tăng counter lần hai.
- Analytics không lưu dữ liệu không cần thiết để nhận diện người dùng.

Cần chốt:

- Danh sách `eventType`.
- Retention của raw event.
- Cách aggregate dữ liệu.
- Có cần bảng aggregate riêng hay không.

## 16. Dashboard

Dashboard không nhất thiết có bảng riêng.

Dữ liệu dashboard được tổng hợp từ:

```text
Artwork
Category
MediaAsset
AnalyticsEvent
AuditLog
```

Chỉ tạo bảng aggregate/cache nếu có nhu cầu hiệu năng thực tế.

## 17. Quan hệ tổng quát

```text
AdminUser
   │
   └──< RefreshTokenSession

Profile
   ├──< Skill
   └──< SocialLink

Artwork >──< Category

Artwork
   └──< ArtworkImage >── MediaAsset

GalleryImage >── MediaAsset

AdminUser
   └──< AuditLog

Artwork
   └──< AnalyticsEvent
```

## 18. Quy tắc reorder

Các entity có reorder:

```text
Category
Artwork
ArtworkImage
Skill
SocialLink
GalleryImage
```

Quy tắc chung:

- Client gửi danh sách ID theo thứ tự mong muốn.
- Server kiểm tra toàn bộ ID hợp lệ.
- Không cho ID trùng.
- Không cho ID ngoài phạm vi resource đang reorder.
- Cập nhật toàn bộ `position` trong một transaction.
- `position` phải có quy ước thống nhất trong toàn project.

Quy ước bắt đầu từ `0` hay `1` **CHƯA CHỐT**.

## 19. Soft delete

Các entity dự kiến dùng soft delete:

```text
Artwork
Category
MediaAsset
GalleryImage
```

Quy tắc:

- Soft delete dùng `deletedAt`.
- Query public luôn loại record có `deletedAt != null`.
- Query admin mặc định cũng không trả record đã deleted, trừ chức năng phục hồi nếu sau này có.
- Unique constraint liên quan `slug` phải được thiết kế phù hợp với soft delete.

Chiến lược unique cụ thể **CHƯA CHỐT**.

## 20. Những quyết định phải chốt trước migration đầu tiên

Trước khi tạo migration thật, phải chốt:

1. Kiểu ID: UUID, ULID hay CUID.
2. Quy tắc unique slug khi soft delete.
3. Artwork có primary category hay không.
4. Artwork có primary image hay không.
5. Thumbnail/derivative của MediaAsset được lưu thế nào.
6. `position` bắt đầu từ `0` hay `1`.
7. Điều kiện và state transition của Artwork.
8. Cách bảo đảm absolute TTL của refresh token family.
9. Retention của RefreshTokenSession, AuditLog và AnalyticsEvent.
10. Các field cụ thể của Profile và Theme.
