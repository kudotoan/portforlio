# Portfolio Art API

Backend REST API cho website trưng bày nghệ thuật trực tuyến.

Hệ thống cung cấp API cho:

- Khách truy cập xem tác phẩm, danh mục, gallery, hồ sơ và giao diện website.
- Quản trị viên đăng nhập và quản lý nội dung website.
- Thu thập số liệu truy cập ẩn danh phục vụ thống kê.

Backend được xây dựng bằng:

- NestJS
- TypeScript
- Prisma ORM
- MySQL

## Yêu cầu

Cần cài đặt:

- Node.js
- npm
- MySQL 8+

## Cài đặt

Cài dependency:

```bash
npm install
```

Tạo file cấu hình môi trường:

```bash
cp .env.example .env
```

Sau đó chỉnh các giá trị cần thiết trong `.env`.

Tạo Prisma Client:

```bash
npx prisma generate
```

Chạy migration cho database development:

```bash
npx prisma migrate dev
```

## Chạy project

Development:

```bash
npm run start:dev
```

Build project:

```bash
npm run build
```

Chạy bản đã build:

```bash
npm run start:prod
```

Mặc định API chạy tại:

```text
http://localhost:3000
```

Product API sử dụng prefix:

```text
/api/v1
```

Ví dụ:

```text
http://localhost:3000/api/v1
```

## Kiểm tra project

Chạy lint:

```bash
npm run lint
```

Chạy test:

```bash
npm run test
```

Chạy end-to-end test:

```bash
npm run test:e2e
```

Chạy test kèm coverage:

```bash
npm run test:cov
```
