# API Contract

Hợp đồng API của backend Portfolio Art.

Base prefix:

```text
/api/v1
```

Health không dùng prefix trên.

## 1. Quy ước chung

- Public API: `/api/v1/public/**`
- Admin API: `/api/v1/admin/**`
- Admin API, trừ login/refresh, dùng Bearer access token.
- Refresh token lưu trong HttpOnly cookie.
- ID dùng `string`.
- Timestamp dùng RFC 3339 UTC.
- Pagination mặc định: `page=1`, `limit=20`, tối đa `100`.
- Field thừa bị từ chối.
- `PATCH` không nhận body rỗng.
- `204 No Content` không có body.

Success response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": {},
  "timestamp": "2026-09-15T00:00:00.000Z",
  "path": "/api/v1/...",
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
  "path": "/api/v1/...",
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
| POST | `/api/v1/admin/auth/login` | `{ username, password }` | `{ accessToken, admin }` + refresh cookie |
| POST | `/api/v1/admin/auth/refresh` | Refresh cookie | `{ accessToken }` + refresh cookie mới |
| POST | `/api/v1/admin/auth/logout` | Refresh cookie | `204` |
| GET | `/api/v1/admin/auth/me` | Bearer | Admin session |
| PATCH | `/api/v1/admin/auth/change-password` | `{ currentPassword, newPassword }` | `204` |

## 4. Media

| Method | Path |
|---|---|
| POST | `/api/v1/admin/media/images` |
| GET | `/api/v1/admin/media` |
| GET | `/api/v1/admin/media/:id` |
| DELETE | `/api/v1/admin/media/:id` |

## 5. Categories

| Method | Path |
|---|---|
| GET | `/api/v1/admin/categories` |
| POST | `/api/v1/admin/categories` |
| PUT | `/api/v1/admin/categories/reorder` |
| GET | `/api/v1/admin/categories/:id` |
| PATCH | `/api/v1/admin/categories/:id` |
| DELETE | `/api/v1/admin/categories/:id` |

## 6. Artworks

| Method | Path |
|---|---|
| GET | `/api/v1/admin/artworks` |
| POST | `/api/v1/admin/artworks` |
| PUT | `/api/v1/admin/artworks/reorder` |
| GET | `/api/v1/admin/artworks/:id` |
| PATCH | `/api/v1/admin/artworks/:id` |
| DELETE | `/api/v1/admin/artworks/:id` |
| PUT | `/api/v1/admin/artworks/:id/categories` |
| PUT | `/api/v1/admin/artworks/:id/images` |
| PATCH | `/api/v1/admin/artworks/:id/status` |
| PATCH | `/api/v1/admin/artworks/:id/featured` |

Artwork status:

```text
DRAFT
PUBLISHED
HIDDEN
ARCHIVED
```

## 7. Profile

| Method | Path |
|---|---|
| GET | `/api/v1/admin/profile` |
| PATCH | `/api/v1/admin/profile` |
| POST | `/api/v1/admin/profile/skills` |
| PUT | `/api/v1/admin/profile/skills/reorder` |
| PATCH | `/api/v1/admin/profile/skills/:id` |
| DELETE | `/api/v1/admin/profile/skills/:id` |
| POST | `/api/v1/admin/profile/social-links` |
| PUT | `/api/v1/admin/profile/social-links/reorder` |
| PATCH | `/api/v1/admin/profile/social-links/:id` |
| DELETE | `/api/v1/admin/profile/social-links/:id` |

Profile là singleton `default`.

## 8. Theme

| Method | Path |
|---|---|
| GET | `/api/v1/admin/theme` |
| PATCH | `/api/v1/admin/theme` |

Theme là singleton `default`.

## 9. Gallery

| Method | Path |
|---|---|
| GET | `/api/v1/admin/gallery-images` |
| POST | `/api/v1/admin/gallery-images` |
| PUT | `/api/v1/admin/gallery-images/reorder` |
| PATCH | `/api/v1/admin/gallery-images/:id` |
| DELETE | `/api/v1/admin/gallery-images/:id` |

## 10. Public API

| Method | Path |
|---|---|
| GET | `/api/v1/public/site` |
| GET | `/api/v1/public/profile` |
| GET | `/api/v1/public/theme` |
| GET | `/api/v1/public/categories` |
| GET | `/api/v1/public/categories/:slug` |
| GET | `/api/v1/public/artworks` |
| GET | `/api/v1/public/artworks/:slug` |
| GET | `/api/v1/public/gallery` |
| POST | `/api/v1/public/analytics/events` |

Public API không trả dữ liệu draft, hidden, archived, deleted hoặc field nội bộ.

## 11. Dashboard, Analytics và Audit

| Method | Path |
|---|---|
| GET | `/api/v1/admin/dashboard/summary` |
| GET | `/api/v1/admin/analytics/overview` |
| GET | `/api/v1/admin/analytics/trend` |
| GET | `/api/v1/admin/analytics/artworks` |
| GET | `/api/v1/admin/analytics/artworks/:id` |
| GET | `/api/v1/admin/audit-logs` |

Date range dùng `YYYY-MM-DD`, tối đa 366 ngày.

## 12. Quy tắc frontend

- Access token chỉ lưu trong memory.
- Reload app: refresh → lưu access token → gọi `/me`.
- Nhiều request cùng nhận `401` chỉ chạy một refresh request.
- Retry request gốc tối đa một lần.
- `403` không gọi refresh.
- Không phụ thuộc route `/test-*`.
