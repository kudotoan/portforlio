# API Contract

Hợp đồng API của backend Portfolio Art.

## 1. Quy ước chung

- Public API: `/public/**`
- Admin API: `/admin/**`
- Admin API, trừ login/refresh, dùng Bearer access token.
- Refresh token lưu trong HttpOnly cookie.
- ID dùng `string`.
- Timestamp dùng RFC 3339 UTC.
- Pagination mặc định: `page=1`, `limit=20`, tối đa `100`.
- Field thừa bị từ chối.
- `PATCH` không nhận body rỗng.
- `DELETE` là hard delete.
- `204 No Content` không có body.

Success response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": {},
  "timestamp": "2026-09-15T00:00:00.000Z",
  "path": "/admin/...",
  "requestId": "uuid"
}
```

Error response:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_FAILED",
  "message": "Request validation failed",
  "details": [],
  "timestamp": "2026-09-15T00:00:00.000Z",
  "path": "/admin/...",
  "requestId": "uuid"
}
```

Frontend rẽ nhánh bằng `statusCode` và `code`, không parse `message`.

## 2. Health

| Method | Path | Mục đích |
|---|---|---|
| GET | `/health` | Alias của `/health/ready` |
| GET | `/health/live` | Kiểm tra tiến trình ứng dụng còn hoạt động |
| GET | `/health/ready` | Kiểm tra ứng dụng và MySQL đã sẵn sàng phục vụ |

Quy ước:

```text
/health
= /health/ready
```

`/health` và `/health/ready` phải phản ánh cùng trạng thái readiness và trả cùng kết quả tương ứng.

## 3. Authentication

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/admin/auth/login` | `{ username, password }` | `{ accessToken, expiresIn, admin }` + refresh cookie |
| POST | `/admin/auth/refresh` | Refresh cookie | `{ accessToken, expiresIn }` + refresh cookie mới |
| POST | `/admin/auth/logout` | Refresh cookie | `204` |
| GET | `/admin/auth/me` | Bearer | Admin session |
| PATCH | `/admin/auth/change-password` | `{ currentPassword, newPassword }` | `204` |

Các object trong cột Response của login và refresh là giá trị `data` trong success response. `expiresIn` là thời hạn access token tính bằng giây, theo `JWT_ACCESS_TTL_SECONDS`.

## 4. Media

| Method | Path |
|---|---|
| POST | `/admin/media/images` |
| GET | `/admin/media` |
| GET | `/admin/media/:id` |
| DELETE | `/admin/media/:id` |

MediaAsset chỉ được hard delete khi không còn Profile, ArtworkImage hoặc GalleryImage tham chiếu.

## 5. Categories

| Method | Path |
|---|---|
| GET | `/admin/categories` |
| POST | `/admin/categories` |
| PUT | `/admin/categories/reorder` |
| GET | `/admin/categories/:id` |
| PATCH | `/admin/categories/:id` |
| DELETE | `/admin/categories/:id` |

Không được hard delete Category nếu thao tác đó làm một Artwork đang `PUBLISHED` không còn Category nào.

## 6. Artworks

| Method | Path |
|---|---|
| GET | `/admin/artworks` |
| POST | `/admin/artworks` |
| PUT | `/admin/artworks/reorder` |
| GET | `/admin/artworks/:id` |
| PATCH | `/admin/artworks/:id` |
| DELETE | `/admin/artworks/:id` |
| PUT | `/admin/artworks/:id/categories` |
| PUT | `/admin/artworks/:id/images` |
| PATCH | `/admin/artworks/:id/status` |
| PATCH | `/admin/artworks/:id/featured` |

Artwork status:

```text
DRAFT
PUBLISHED
HIDDEN
ARCHIVED
```

Quy tắc:

- Chỉ được hard delete Artwork khi trạng thái khác `PUBLISHED`.
- Artwork chuyển sang `PUBLISHED` phải có ít nhất một Category và một ArtworkImage.
- Ảnh có `position = 0` là ảnh chính.
- Không được bỏ ảnh cuối cùng khỏi Artwork đang `PUBLISHED`.

## 7. Profile

| Method | Path |
|---|---|
| GET | `/admin/profile` |
| PATCH | `/admin/profile` |
| POST | `/admin/profile/skills` |
| PUT | `/admin/profile/skills/reorder` |
| PATCH | `/admin/profile/skills/:id` |
| DELETE | `/admin/profile/skills/:id` |
| POST | `/admin/profile/social-links` |
| PUT | `/admin/profile/social-links/reorder` |
| PATCH | `/admin/profile/social-links/:id` |
| DELETE | `/admin/profile/social-links/:id` |

Profile là singleton `default`.

## 8. Gallery

| Method | Path |
|---|---|
| GET | `/admin/gallery-images` |
| POST | `/admin/gallery-images` |
| PUT | `/admin/gallery-images/reorder` |
| PATCH | `/admin/gallery-images/:id` |
| DELETE | `/admin/gallery-images/:id` |

Hard delete GalleryImage chỉ xóa row liên kết, không tự xóa MediaAsset.

## 9. Public API

| Method | Path |
|---|---|
| GET | `/public/site` |
| GET | `/public/profile` |
| GET | `/public/categories` |
| GET | `/public/categories/:slug` |
| GET | `/public/artworks` |
| GET | `/public/artworks/:slug` |
| GET | `/public/gallery` |
| POST | `/public/analytics/events` |

Public API chỉ trả dữ liệu được phép công khai và không trả Artwork có trạng thái `DRAFT`, `HIDDEN`, `ARCHIVED` hoặc field nội bộ.

Analytics event:

```text
SITE_VIEW
ARTWORK_VIEW
```

Quy tắc:

- `eventId` là UUID do client tạo và dùng để chống ghi trùng.
- `SITE_VIEW` phải có `artworkId = null`.
- `ARTWORK_VIEW` phải có `artworkId` hợp lệ.
- `occurredAt` không được cũ hơn 24 giờ và không vượt quá thời gian server 5 phút.
- Không lưu IP, user-agent đầy đủ, cookie, fingerprint, email hoặc dữ liệu nhận diện người dùng.

## 10. Dashboard và Analytics

| Method | Path |
|---|---|
| GET | `/admin/dashboard/summary` |
| GET | `/admin/analytics/overview` |
| GET | `/admin/analytics/trend` |
| GET | `/admin/analytics/artworks` |
| GET | `/admin/analytics/artworks/:id` |

Date range dùng `YYYY-MM-DD`, tối đa 366 ngày.

Dashboard và Analytics tổng hợp trực tiếp từ dữ liệu hiện có và raw `AnalyticsEvent`; không có bảng aggregate/cache riêng trong phiên bản đầu tiên.

## 11. Quy tắc reorder

Các endpoint reorder áp dụng cho:

```text
Category
Artwork
ArtworkImage
Skill
SocialLink
GalleryImage
```

Quy tắc:

- `position` bắt đầu từ `0` và liên tục trong từng scope.
- Client gửi đầy đủ danh sách ID trong scope theo thứ tự mong muốn.
- Server từ chối danh sách thiếu ID, thừa ID, trùng ID hoặc chứa ID ngoài scope.
- Reorder cập nhật toàn bộ scope trong một transaction.

## 12. Quy tắc frontend

- Access token chỉ lưu trong memory.
- Reload app: refresh → lưu access token → gọi `/me`.
- Nhiều request cùng nhận `401` chỉ chạy một refresh request.
- Retry request gốc tối đa một lần.
- `403` không gọi refresh.
- Không phụ thuộc route `/test-*`.
