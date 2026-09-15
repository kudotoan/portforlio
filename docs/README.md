# Portfolio Art API

Backend REST API cho website trưng bày nghệ thuật trực tuyến. Hệ thống phục vụ hai nhóm người dùng:

- Khách truy cập đọc nội dung công khai và gửi analytics ẩn danh.
- Một quản trị viên quản lý tác phẩm, danh mục, media, hồ sơ, giao diện và số liệu.

Project không bao gồm đăng ký tài khoản công khai, bình luận, đặt hàng hoặc thanh toán.

## Công nghệ và nguyên tắc chung

- NestJS 11, TypeScript và REST API có version.
- Prisma ORM 7 với MySQL 8+.
- `class-validator` và `class-transformer` để kiểm tra input tại biên HTTP.
- Pino để ghi log có cấu trúc.
- Joi để kiểm tra biến môi trường trước khi ứng dụng khởi động.
- Controller chỉ nhận request, gọi nghiệp vụ và trả view model; không trả trực tiếp Prisma model.
- Các feature tuân theo hướng phụ thuộc: `presentation -> application -> domain <- infrastructure`.
- Các thành phần dùng chung như config, logger, validation, exception filter và response interceptor đặt trong `src/common` hoặc `src/configuration`.

Base URL mặc định:

```text
http://localhost:3000/api/v1
```

## Cài đặt

Yêu cầu:

- Node.js bản LTS và npm.
- MySQL 8+ đang hoạt động.

Từ thư mục `backend`:

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

Ví dụ cấu hình `.env`:

```dotenv
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
DATABASE_URL=mysql://username:password@localhost:3306/portfolio_art
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:5173
```

### Biến môi trường

| Biến | Bắt buộc | Mặc định | Ý nghĩa |
| --- | --- | --- | --- |
| `NODE_ENV` | Không | `development` | Một trong `development`, `test`, `production`. |
| `PORT` | Không | `3000` | Cổng HTTP của ứng dụng. |
| `API_PREFIX` | Không | `api/v1` | Prefix dùng chung cho toàn bộ API. |
| `DATABASE_URL` | Có | Không có | MySQL connection URI. |
| `LOG_LEVEL` | Không | `info` | Một trong `fatal`, `error`, `warn`, `info`, `debug`, `trace`. |
| `CORS_ORIGIN` | Có | Không có | Origin frontend hợp lệ, dùng giao thức `http` hoặc `https`. |

Ứng dụng không khởi động nếu cấu hình bắt buộc bị thiếu hoặc giá trị không hợp lệ. CORS cho phép gửi credentials từ `CORS_ORIGIN` đã cấu hình.

## Quy ước HTTP

- Request và response nghiệp vụ dùng JSON, trừ các API media chuyên biệt.
- API prefix mặc định là `/api/v1`.
- HTTP status code phải phản ánh kết quả thực tế: ví dụ `200` khi đọc thành công, `201` khi tạo thành công và `202` khi request đã được chấp nhận để xử lý.
- Input được tự động chuyển về kiểu khai báo trong DTO.
- Thuộc tính không được khai báo trong DTO bị từ chối; client không được gửi field dư.
- Timestamp trong response dùng ISO 8601 theo UTC.
- `path` là URL gốc của request, bao gồm prefix và query string nếu có.

## Chuẩn response thành công

Mọi response thành công có body được bọc theo `ApiResponse<T>`:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": {
    "id": 1,
    "title": "Example artwork"
  },
  "timestamp": "2026-08-30T08:00:00.000Z",
  "path": "/api/v1/artworks/1",
  "requestId": "25b63d42-3d46-47a7-b183-06b609b8420b"
}
```

| Field | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `success` | `true` | Xác nhận request thành công. |
| `statusCode` | `number` | Trùng với HTTP status code thực tế. |
| `message` | `string` | Thông báo chung; hiện tại là `Request successful`. |
| `data` | `T` | Dữ liệu do controller trả về; có thể là object, mảng, kiểu nguyên thủy hoặc `null`. |
| `timestamp` | `string` | Thời điểm tạo response theo ISO 8601 UTC. |
| `path` | `string` | URL gốc của request. |
| `requestId` | `string` | Mã dùng để truy vết request giữa client và log. |

Controller chỉ trả dữ liệu nghiệp vụ, không tự bọc thêm một lớp `success`, `statusCode` hoặc `data`. Response interceptor chịu trách nhiệm tạo envelope này. Với `204 No Content`, response không có body theo chuẩn HTTP.

Ví dụ response cho danh sách:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": [
    {
      "id": 1,
      "title": "First artwork"
    },
    {
      "id": 2,
      "title": "Second artwork"
    }
  ],
  "timestamp": "2026-08-30T08:00:00.000Z",
  "path": "/api/v1/artworks",
  "requestId": "client-request-001"
}
```

## Chuẩn error response

Response lỗi không dùng success envelope và không có trường `data` hoặc `success`:

```json
{
  "statusCode": 404,
  "message": "Artwork not found",
  "error": "Not Found",
  "path": "/api/v1/artworks/999",
  "requestId": "25b63d42-3d46-47a7-b183-06b609b8420b",
  "timestamp": "2026-08-30T08:00:00.000Z"
}
```

| Field | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `statusCode` | `number` | Trùng với HTTP status code thực tế. |
| `message` | `string \| string[]` | Mô tả lỗi; là mảng khi có một hoặc nhiều lỗi validation. |
| `error` | `string` | Nhóm lỗi HTTP, ví dụ `Bad Request`, `Unauthorized`, `Not Found`. |
| `path` | `string` | URL gây ra lỗi. |
| `requestId` | `string` | Mã truy vết tương ứng với request và log. |
| `timestamp` | `string` | Thời điểm tạo error response theo ISO 8601 UTC. |

Ví dụ lỗi validation:

```json
{
  "statusCode": 400,
  "message": [
    "title must be a string",
    "property unknownField should not exist"
  ],
  "error": "Bad Request",
  "path": "/api/v1/artworks",
  "requestId": "client-request-002",
  "timestamp": "2026-08-30T08:00:00.000Z"
}
```

Ví dụ lỗi hệ thống không xác định:

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error",
  "path": "/api/v1/artworks",
  "requestId": "25b63d42-3d46-47a7-b183-06b609b8420b",
  "timestamp": "2026-08-30T08:00:00.000Z"
}
```

Không trả stack trace, câu SQL, thông tin Prisma, credential hoặc chi tiết nội bộ cho client. Lỗi `4xx` được log ở mức `warn`; lỗi từ `500` được log ở mức `error` cùng exception gốc để điều tra phía server.

`error` hiện là tên nhóm lỗi để con người đọc, chưa phải mã lỗi nghiệp vụ ổn định. Client nên xử lý dựa trên HTTP status/`statusCode` và chỉ dùng `message` để hiển thị phù hợp; không parse nội dung chuỗi `error` hoặc `message` để điều khiển logic.

### Các nhóm HTTP status thường dùng

| Status | Khi sử dụng |
| --- | --- |
| `400 Bad Request` | Payload, query hoặc params không hợp lệ. |
| `401 Unauthorized` | Chưa đăng nhập hoặc token không hợp lệ/hết hạn. |
| `403 Forbidden` | Đã xác thực nhưng không có quyền thực hiện. |
| `404 Not Found` | Không tìm thấy resource. |
| `409 Conflict` | Dữ liệu xung đột, ví dụ slug hoặc field unique đã tồn tại. |
| `422 Unprocessable Entity` | Request đúng cú pháp nhưng vi phạm quy tắc nghiệp vụ. |
| `429 Too Many Requests` | Vượt giới hạn request. |
| `500 Internal Server Error` | Lỗi hệ thống không mong đợi. |

## Request ID và logging

Client có thể gửi header:

```http
X-Request-Id: client-request-001
```

Request ID do client cung cấp chỉ được chấp nhận khi:

- Không rỗng và dài tối đa 128 ký tự.
- Chỉ chứa chữ cái, chữ số, dấu chấm (`.`), gạch dưới (`_`) hoặc gạch ngang (`-`).

Nếu header thiếu hoặc không hợp lệ, server tự sinh UUID. Giá trị cuối cùng được trả ở cả header `X-Request-Id` và body response để frontend có thể gửi kèm khi báo lỗi.

Log được hiển thị dễ đọc ở development và ở dạng JSON trong production. Các giá trị nhạy cảm như `authorization`, `cookie`, `x-api-key` và `set-cookie` được che khỏi log.

## Database

Prisma là lớp truy cập MySQL duy nhất của ứng dụng. Feature module sử dụng `PrismaService` qua dependency injection; frontend không truy cập database trực tiếp.

Các lệnh Prisma thường dùng:

```bash
npx prisma generate
npx prisma migrate dev
npx prisma migrate deploy
npx prisma studio
```

Migration production dùng `prisma migrate deploy`; không dùng `prisma migrate dev` trên production.

## Scripts

```bash
npm run start:dev   # chạy development với watch mode
npm run build       # build TypeScript
npm run start:prod  # chạy bản build trong dist
npm run lint        # kiểm tra và tự sửa lint
npm run format      # format source và test
npm run test        # unit test
npm run test:e2e    # end-to-end test
npm run test:cov    # test kèm coverage
```



API dự kiến triển khai:
Authentication

POST  /api/v1/admin/auth/login
POST  /api/v1/admin/auth/refresh
POST  /api/v1/admin/auth/logout
GET   /api/v1/admin/auth/me
PATCH /api/v1/admin/auth/change-password


Các API public:

GET /artworks
GET /artworks/:id
GET /artists
GET /exhibitions

→ ai cũng gọi được.

Các API quản trị:

POST   /artworks
PATCH  /artworks/:id
DELETE /artworks/:id
POST   /uploads


