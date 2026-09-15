# Backend API Contract

Tài liệu này là danh sách API backend thống nhất để frontend triển khai. `CURRENT` là route đang có trong source; `PLANNED` là route đã dự kiến nhưng chưa được gọi ở runtime.

## Quy ước chung

- Product prefix: `/api/v1`.
- Health không dùng product prefix.
- Public API: `/api/v1/public/**`.
- Admin API: `/api/v1/admin/**`.
- Admin API, trừ login/refresh, dùng `Authorization: Bearer <accessToken>`.
- Refresh token nằm trong HttpOnly cookie; frontend gửi `credentials: 'include'`.
- ID là string; timestamp là RFC 3339 UTC.
- List query chung: `page=1`, `limit=20`, `q`, `sortBy`, `sortDirection`; `limit` tối đa 100.
- Field thừa bị từ chối. `PATCH` không nhận body rỗng.

Response thành công có body:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": {},
  "timestamp": "2026-09-14T10:20:30.000Z",
  "path": "/api/v1/...",
  "requestId": "uuid"
}
```

Response lỗi mục tiêu:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_FAILED",
  "message": "Request validation failed",
  "details": [],
  "timestamp": "2026-09-14T10:20:30.000Z",
  "path": "/api/v1/...",
  "requestId": "uuid"
}
```

Frontend rẽ nhánh bằng `statusCode` và `code`, không so sánh nội dung `message`. Response `204` không có body.

## Health

| Trạng thái | Method | Path            | Response                                                |
| ---------- | ------ | --------------- | ------------------------------------------------------- |
| `CURRENT`  | GET    | `/health`       | 200 readiness; 503 khi MySQL down                       |
| `CURRENT`  | GET    | `/health/live`  | 200 `{ status, timestamp }`                             |
| `CURRENT`  | GET    | `/health/ready` | 200 `{ status, timestamp, checks }`; 503 khi MySQL down |

## Authentication

| Trạng thái | Method | Path                                 | Request                            | Response                                      |
| ---------- | ------ | ------------------------------------ | ---------------------------------- | --------------------------------------------- |
| `CURRENT`  | POST   | `/api/v1/admin/auth/login`           | `{ username, password }`           | 200 `{ accessToken, admin }` + refresh cookie |
| `CURRENT`  | POST   | `/api/v1/admin/auth/refresh`         | Refresh cookie                     | 200 `{ accessToken }` + refresh cookie mới    |
| `PLANNED`  | POST   | `/api/v1/admin/auth/logout`          | Refresh cookie/Bearer              | 204 + xóa cookie                              |
| `PLANNED`  | GET    | `/api/v1/admin/auth/me`              | Bearer                             | 200 `AdminSessionView`                        |
| `PLANNED`  | PATCH  | `/api/v1/admin/auth/change-password` | `{ currentPassword, newPassword }` | 204 + revoke mọi session + xóa cookie         |

```ts
type AdminSessionView = {
  id: string;
  username: string;
  role: 'ADMIN';
  isActive: boolean;
  mustChangePassword: boolean;
};
```

## Media Admin

| Method | Path                         | Request/query                        | Response                          |
| ------ | ---------------------------- | ------------------------------------ | --------------------------------- |
| POST   | `/api/v1/admin/media/images` | multipart field `file`               | 201 `AdminMediaView`              |
| GET    | `/api/v1/admin/media`        | pagination, `q`, `mimeType`, `usage` | 200 paginated media               |
| GET    | `/api/v1/admin/media/:id`    | —                                    | 200 `AdminMediaView`              |
| DELETE | `/api/v1/admin/media/:id`    | —                                    | 204; 409 nếu asset đang được dùng |

## Categories Admin

| Method | Path                               | Request/query                                              | Response                        |
| ------ | ---------------------------------- | ---------------------------------------------------------- | ------------------------------- |
| GET    | `/api/v1/admin/categories`         | pagination, `q`, `isVisible`                               | 200 paginated categories        |
| POST   | `/api/v1/admin/categories`         | `{ name, slug?, description?, coverAssetId?, isVisible? }` | 201 category                    |
| GET    | `/api/v1/admin/categories/:id`     | —                                                          | 200 category                    |
| PATCH  | `/api/v1/admin/categories/:id`     | các field được phép cập nhật                               | 200 category                    |
| DELETE | `/api/v1/admin/categories/:id`     | —                                                          | 204; 409 nếu còn được dùng      |
| PUT    | `/api/v1/admin/categories/reorder` | `{ orderedIds: string[] }`                                 | 200 danh sách theo thứ tự chuẩn |

## Artworks Admin

| Method | Path                                    | Request/query                                             | Response                        |
| ------ | --------------------------------------- | --------------------------------------------------------- | ------------------------------- |
| GET    | `/api/v1/admin/artworks`                | pagination, `q`, `status`, `categoryId`, `featured`, sort | 200 paginated artwork summaries |
| POST   | `/api/v1/admin/artworks`                | metadata artwork; luôn tạo `DRAFT`                        | 201 artwork detail              |
| GET    | `/api/v1/admin/artworks/:id`            | —                                                         | 200 artwork detail              |
| PATCH  | `/api/v1/admin/artworks/:id`            | metadata được phép cập nhật                               | 200 artwork detail              |
| DELETE | `/api/v1/admin/artworks/:id`            | —                                                         | 204 soft delete                 |
| PUT    | `/api/v1/admin/artworks/:id/categories` | `{ primaryCategoryId, categoryIds }`                      | 200 artwork detail              |
| PUT    | `/api/v1/admin/artworks/:id/images`     | `{ items: [{ mediaAssetId, caption?, altText? }] }`       | 200 ordered images              |
| PATCH  | `/api/v1/admin/artworks/:id/status`     | `{ status }`                                              | 200 artwork detail              |
| PATCH  | `/api/v1/admin/artworks/:id/featured`   | `{ isFeatured }`                                          | 200 artwork summary             |
| PUT    | `/api/v1/admin/artworks/reorder`        | `{ orderedIds: string[] }`                                | 200 danh sách theo thứ tự chuẩn |

Trạng thái artwork: `DRAFT`, `PUBLISHED`, `HIDDEN`, `ARCHIVED`. Publish yêu cầu title, slug, primary category visible và ít nhất một ảnh hợp lệ.

## Profile Admin

| Method | Path                                         | Request                                 | Response                            |
| ------ | -------------------------------------------- | --------------------------------------- | ----------------------------------- |
| GET    | `/api/v1/admin/profile`                      | —                                       | 200 profile + skills + social links |
| PATCH  | `/api/v1/admin/profile`                      | profile fields                          | 200 profile                         |
| POST   | `/api/v1/admin/profile/skills`               | `{ name, level?, isVisible? }`          | 201 skill                           |
| PATCH  | `/api/v1/admin/profile/skills/:id`           | skill fields                            | 200 skill                           |
| DELETE | `/api/v1/admin/profile/skills/:id`           | —                                       | 204                                 |
| PUT    | `/api/v1/admin/profile/skills/reorder`       | `{ orderedIds }`                        | 200 ordered skills                  |
| POST   | `/api/v1/admin/profile/social-links`         | `{ platform, label?, url, isVisible? }` | 201 social link                     |
| PATCH  | `/api/v1/admin/profile/social-links/:id`     | social-link fields                      | 200 social link                     |
| DELETE | `/api/v1/admin/profile/social-links/:id`     | —                                       | 204                                 |
| PUT    | `/api/v1/admin/profile/social-links/reorder` | `{ orderedIds }`                        | 200 ordered social links            |

Profile là singleton có ID `default`; frontend không gửi profile ID.

## Theme Admin

| Method | Path                  | Request                                       | Response                    |
| ------ | --------------------- | --------------------------------------------- | --------------------------- |
| GET    | `/api/v1/admin/theme` | —                                             | 200 theme                   |
| PATCH  | `/api/v1/admin/theme` | palette, font, hero/background, footer fields | 200 theme với `version` mới |

Theme là singleton `default`. Backend chỉ nhận color/font trong allow-list, không nhận CSS/script/font URL tùy ý.

## Gallery Admin

| Method | Path                                   | Request/query                                                   | Response            |
| ------ | -------------------------------------- | --------------------------------------------------------------- | ------------------- |
| GET    | `/api/v1/admin/gallery-images`         | pagination, visibility/featured filter                          | 200 paginated items |
| POST   | `/api/v1/admin/gallery-images`         | `{ mediaAssetId, caption?, altText?, isVisible?, isFeatured? }` | 201 item            |
| PATCH  | `/api/v1/admin/gallery-images/:id`     | các field được phép cập nhật                                    | 200 item            |
| DELETE | `/api/v1/admin/gallery-images/:id`     | —                                                               | 204 soft delete     |
| PUT    | `/api/v1/admin/gallery-images/reorder` | `{ orderedIds }`                                                | 200 ordered items   |

## Public Content

| Method | Path                              | Query                                | Response                                                     |
| ------ | --------------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| GET    | `/api/v1/public/site`             | —                                    | 200 profile tóm tắt + theme + navigation + featured artworks |
| GET    | `/api/v1/public/profile`          | —                                    | 200 profile + visible skills/social links                    |
| GET    | `/api/v1/public/theme`            | —                                    | 200 public theme                                             |
| GET    | `/api/v1/public/categories`       | —                                    | 200 visible categories                                       |
| GET    | `/api/v1/public/categories/:slug` | pagination                           | 200 category + published artworks                            |
| GET    | `/api/v1/public/artworks`         | pagination, category, featured, sort | 200 published artworks                                       |
| GET    | `/api/v1/public/artworks/:slug`   | —                                    | 200 artwork detail + related artworks                        |
| GET    | `/api/v1/public/gallery`          | pagination                           | 200 visible gallery items                                    |
| POST   | `/api/v1/public/analytics/events` | analytics event                      | 202 `{ accepted: true }`                                     |

Public API không trả draft/hidden/archived/deleted content, storage key, token, audit hoặc field quản trị.

## Dashboard, Analytics và Audit Admin

| Method | Path                                   | Query                                         | Response                                   |
| ------ | -------------------------------------- | --------------------------------------------- | ------------------------------------------ |
| GET    | `/api/v1/admin/dashboard/summary`      | `from?`, `to?`, `timezone?`                   | 200 counters + top artworks + recent audit |
| GET    | `/api/v1/admin/analytics/overview`     | `from`, `to`, `timezone?`                     | 200 totals + comparison                    |
| GET    | `/api/v1/admin/analytics/trend`        | date range + `interval`                       | 200 time-series points                     |
| GET    | `/api/v1/admin/analytics/artworks`     | date range + pagination/sort                  | 200 paginated artwork metrics              |
| GET    | `/api/v1/admin/analytics/artworks/:id` | date range                                    | 200 artwork totals + time series           |
| GET    | `/api/v1/admin/audit-logs`             | pagination + actor/action/entity/date filters | 200 sanitized audit logs                   |

Date range dùng `YYYY-MM-DD`, tối đa 366 ngày. Timezone dùng tên IANA như `Asia/Ho_Chi_Minh`.

## Quy tắc frontend bắt buộc

1. Access token chỉ giữ trong memory.
2. Reload app: gọi refresh → lưu access token → gọi `/me` → dựng auth state.
3. Nhiều request cùng nhận 401 chỉ gọi một refresh request; retry request gốc tối đa một lần.
4. 403 không gọi refresh.
5. Không gọi route `PLANNED` cho tới khi backend có OpenAPI tương ứng.
6. Không phụ thuộc các route `/test-*`; chúng không thuộc contract.
