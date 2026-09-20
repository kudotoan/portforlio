# Prisma CLI

Ghi nhanh các lệnh Prisma CLI thường dùng trong project.

> Project hiện dùng Prisma 7, MySQL và chạy CLI bằng `npx prisma ...`.

---

## 1. Kiểm tra phiên bản

```bash
npx prisma --version
```

Hiển thị phiên bản Prisma CLI, Prisma Client và một số thông tin môi trường.

---

## 2. Khởi tạo Prisma

```bash
npx prisma init --datasource-provider mysql --output ../src/generated/prisma
```

Dùng khi khởi tạo Prisma lần đầu cho project MySQL.

Thông thường chỉ chạy **một lần**.

---

## 3. Kiểm tra schema

### Kiểm tra schema có hợp lệ không

```bash
npx prisma validate
```

Nên chạy sau khi sửa `prisma/schema.prisma`.

### Format schema

```bash
npx prisma format
```

Tự định dạng lại `prisma/schema.prisma`.

---

## 4. Sinh Prisma Client

```bash
npx prisma generate
```

Sinh lại Prisma Client từ `prisma/schema.prisma`.

Cần chạy lại sau khi thay đổi model, field, enum hoặc relation trong schema.

---

## 5. Migration trong môi trường development

### Tạo và chạy migration mới

```bash
npx prisma migrate dev --name <migration_name>
```

Ví dụ migration đầu tiên:

```bash
npx prisma migrate dev --name init
```

Ví dụ thêm analytics:

```bash
npx prisma migrate dev --name add_analytics_event
```

Lệnh này:

1. So sánh schema hiện tại với lịch sử migration.
2. Tạo thư mục migration mới.
3. Chạy migration lên database development.
4. Cập nhật Prisma Client khi cần.

Tên migration nên viết ngắn gọn bằng `snake_case`.

---

## 6. Xem trạng thái migration

```bash
npx prisma migrate status
```

Dùng để kiểm tra:

- Migration nào đã chạy.
- Migration nào chưa chạy.
- Database có đồng bộ với migration history hay không.

---

## 7. Reset database development

```bash
npx prisma migrate reset
```

Lệnh này sẽ:

- Xóa dữ liệu hiện tại.
- Tạo lại schema database.
- Chạy lại toàn bộ migration.
- Chạy seed nếu project có cấu hình seed.

**Cảnh báo:** mất toàn bộ dữ liệu trong database đang kết nối.

Chỉ dùng với database development/test.

---

## 8. Chạy migration đã có

```bash
npx prisma migrate deploy
```

Chỉ chạy các migration đã tồn tại trong:

```text
prisma/migrations/
```

Không tự tạo migration mới.

Dùng cho:

- Production.
- CI/CD.
- Kiểm tra migration trên database sạch.

Ví dụ quy trình kiểm tra database sạch:

```bash
npx prisma migrate deploy
npx prisma migrate status
```

---

## 9. Đồng bộ schema trực tiếp xuống database

```bash
npx prisma db push
```

Đẩy `schema.prisma` trực tiếp xuống database mà **không tạo migration**.

Trong project này chỉ nên dùng khi thử nghiệm schema tạm thời.

Khi đã bắt đầu quản lý database bằng migration thì ưu tiên:

```bash
npx prisma migrate dev --name <migration_name>
```

thay vì `db push`.

---

## 10. Đọc cấu trúc database hiện tại

```bash
npx prisma db pull
```

Đọc schema từ database rồi cập nhật `prisma/schema.prisma`.

Chủ yếu dùng khi:

- Làm việc với database đã tồn tại từ trước.
- Muốn introspect database.

Không nên chạy tùy tiện vì có thể làm thay đổi schema Prisma hiện tại.

---

## 11. Prisma Studio

```bash
npx prisma studio
```

Mở giao diện web để xem và chỉnh sửa dữ liệu trong database.

Phù hợp khi kiểm tra nhanh dữ liệu development.

Không nên coi Prisma Studio là giao diện quản trị production.

---

## 12. Seed database

Nếu project đã cấu hình seed:

```bash
npx prisma db seed
```

Dùng để tạo dữ liệu ban đầu, ví dụ:

```text
AdminUser OWNER đầu tiên
Profile id = "default"
```

---

## 13. Xem trợ giúp

```bash
npx prisma --help
```

Hoặc xem trợ giúp cho từng nhóm lệnh:

```bash
npx prisma migrate --help
npx prisma db --help
npx prisma generate --help
```

---

# Quy trình thường dùng trong project

## Sau khi sửa `schema.prisma`

```bash
npx prisma format
npx prisma validate
npx prisma migrate dev --name <migration_name>
```

Sau đó nếu cần sinh lại client riêng:

```bash
npx prisma generate
```

---

## Kiểm tra migration đầu tiên trên database sạch

1. Trỏ `DATABASE_URL` sang một database MySQL trống.
2. Chạy:

```bash
npx prisma migrate deploy
```

3. Kiểm tra:

```bash
npx prisma migrate status
```

4. Nếu cần xem dữ liệu/schema trực quan:

```bash
npx prisma studio
```

---

# Các lệnh cần nhớ nhất

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate dev --name <name>
npx prisma migrate status
npx prisma migrate reset
npx prisma migrate deploy
npx prisma db seed
npx prisma studio
```

---

# Lưu ý

- Không sửa migration cũ sau khi migration đó đã được dùng làm mốc lịch sử.
- Mỗi thay đổi data model sau migration đầu tiên phải tạo migration mới.
- Không dùng `migrate reset` trên production.
- Không dùng `db push` thay cho migration trong luồng phát triển chính của project.
- Trước khi migration, nên chạy `prisma format` và `prisma validate`.
