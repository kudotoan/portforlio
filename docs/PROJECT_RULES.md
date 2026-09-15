# PROJECT_RULES.md

# Quy chuẩn thống nhất cho dự án NestJS

Tài liệu này là **luật gốc của project**.

Mục tiêu của tài liệu là để toàn bộ source code trong project được viết theo một phong cách thống nhất, dễ đọc, dễ kiểm tra, dễ bảo trì và có thể tiếp tục áp dụng cho các project NestJS khác.

Nếu code hiện tại mâu thuẫn với tài liệu này, ưu tiên sửa code theo tài liệu này, trừ khi có lý do kỹ thuật cụ thể và được ghi rõ.

---

# 1. Mục tiêu chung

Project ưu tiên theo thứ tự:

```text
Đúng
→ An toàn
→ Tường minh
→ Dễ đọc
→ Thống nhất
→ Dễ bảo trì
→ Hiệu năng
→ Ngắn gọn
```

Không tối ưu code chỉ để giảm số dòng.

Không sử dụng cú pháp ngắn, khó đọc hoặc “thông minh” nếu cách viết tường minh hơn giúp người đọc hiểu nhanh hơn.

Một người đọc code phải dễ dàng trả lời được:

```text
Dữ liệu từ đâu vào?
Ai kiểm tra dữ liệu?
Nghiệp vụ nằm ở đâu?
Ai truy cập database?
Ai kiểm tra đăng nhập?
Ai kiểm tra quyền?
Kết quả được trả ra ở đâu?
```

Nếu có nhiều cách TypeScript/NestJS cùng giải quyết một vấn đề, project phải chọn **một cách duy nhất** và sử dụng thống nhất.

---

# 2. Công nghệ nền của project

Project sử dụng:

```text
NestJS
TypeScript
ESM
Vitest
Prisma ORM
MySQL
class-validator
class-transformer
Pino
Joi
Helmet
CORS
cookie-parser
rate limit
```

Các công nghệ mới chỉ được thêm khi có nhu cầu thực tế.

Không thêm thư viện chỉ vì phổ biến hoặc vì AI đề xuất.

---

# 3. Kiến trúc tổng thể

Cấu trúc cấp cao:

```text
src/
├── modules/
├── database/
├── config/
├── common/
├── app.module.ts
└── main.ts
```

Ý nghĩa:

```text
modules/       = nghiệp vụ của hệ thống
database/      = kết nối và cấu hình database
config/        = cấu hình chương trình
common/        = thành phần thật sự dùng chung
app.module.ts  = module gốc ghép các module lớn
main.ts        = điểm bắt đầu chương trình
```

Không tạo thêm các tầng:

```text
application/
domain/
infrastructure/
presentation/
ports/
adapters/
use-cases/
```

nếu chưa có nhu cầu kỹ thuật thực tế.

Không áp dụng Clean Architecture một cách máy móc.

---

# 4. Chia project theo chức năng

Project chia theo feature/module nghiệp vụ.

Ví dụ:

```text
modules/
├── auth/
├── artworks/
├── categories/
├── media/
├── analytics/
├── profile/
└── theme/
```

Không chia toàn project thành:

```text
controllers/
services/
repositories/
```

rồi gom tất cả module vào cùng một chỗ.

Mọi file thuộc cùng một nghiệp vụ phải nằm gần nhau.

Ví dụ module nhỏ:

```text
categories/
├── categories.controller.ts
├── categories.service.ts
├── categories.repository.ts
├── category.model.ts
└── categories.module.ts
```

Module lớn mới chia thêm:

```text
auth/
├── controllers/
├── services/
├── repositories/
├── dto/
├── models/
├── security/
├── guards/
├── decorators/
├── constants/
└── auth.module.ts
```

Không tạo thư mục rỗng chỉ để giống sơ đồ kiến trúc.

---

# 5. Luồng xử lý chuẩn

Luồng chuẩn:

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

Kết quả:

```text
MySQL
  ↓
Prisma
  ↓
Repository
  ↓
Service
  ↓
Controller
  ↓
HTTP Response
```

Không nhảy tầng.

Cấm:

```text
Controller → Prisma
Controller → Repository
Service → Prisma
```

Controller chỉ gọi Service.

Service gọi Repository và các service kỹ thuật cần thiết.

Repository mới được sử dụng Prisma.

---

# 6. Controller

Controller chịu trách nhiệm về HTTP.

Controller được phép:

```text
đọc body
đọc query
đọc param
đọc cookie
đọc header
đọc user đã xác thực
gọi service
set cookie
set response header
trả response
```

Controller không được:

```text
query database trực tiếp
gọi Prisma
hash password
tạo JWT trực tiếp
xử lý transaction
chứa nghiệp vụ chính
```

Ví dụ:

```ts
@Post('login')
public async login(@Body() request: LoginRequestDto): Promise<LoginResponseDto> {
  const result: LoginResult = await this.authService.login({
    username: request.username,
    password: request.password,
  });

  const response: LoginResponseDto = {
    accessToken: result.accessToken,
    admin: result.admin,
  };

  return response;
}
```

---

# 7. Service

Service chứa nghiệp vụ.

Ví dụ:

```ts
public async login(input: LoginInput): Promise<LoginResult> {
}

public async refresh(input: RefreshInput): Promise<RefreshResult> {
}

public async logout(input: LogoutInput): Promise<void> {
}

public async changePassword(input: ChangePasswordInput): Promise<void> {
}
```

Không mặc định tạo một class UseCase cho từng thao tác nhỏ.

Không tạo:

```text
LoginUseCase
LogoutUseCase
RotateRefreshTokenUseCase
ChangePasswordUseCase
```

nếu một `AuthService` vẫn đủ rõ ràng.

Chỉ tách service/use case riêng khi:

```text
class trở nên quá lớn
nghiệp vụ đủ phức tạp
cần tái sử dụng độc lập
cần tách boundary rõ ràng
```

Service trả lời câu hỏi:

```text
Nghiệp vụ này phải thực hiện những bước nào?
```

---

# 8. Repository

Repository chịu trách nhiệm truy cập database.

Ví dụ:

```ts
public async findAdminByUsername(username: string): Promise<AdminUser | null> {
}

public async createRefreshSession(input: CreateRefreshSessionInput): Promise<RefreshSession> {
}

public async revokeRefreshSession(input: RevokeRefreshSessionInput): Promise<void> {
}
```

Chỉ repository được dùng:

```ts
this.prisma...
```

Repository không chứa nghiệp vụ ngoài việc đọc/ghi dữ liệu.

Không để Prisma-generated type lan sang Service hoặc Controller.

Repository phải map dữ liệu Prisma sang model nội bộ khi cần.

---

# 9. Transaction

Các thao tác database phải thành công hoặc thất bại cùng nhau phải dùng transaction.

Ví dụ:

```text
đổi password
+
revoke toàn bộ refresh session
```

hoặc:

```text
revoke refresh session hiện tại
+
tạo refresh session thay thế
```

Transaction nằm trong Repository.

Service chỉ gọi một thao tác nguyên tử:

```ts
await this.authRepository.changePasswordAndRevokeSessions(input);
```

---

# 10. DTO

DTO dùng cho HTTP boundary.

Ví dụ:

```text
dto/
├── login.request.dto.ts
├── login.response.dto.ts
├── change-password.request.dto.ts
└── update-artwork.request.dto.ts
```

Request DTO dùng `class`.

Ví dụ:

```ts
export class LoginRequestDto {
  @IsString()
  public username!: string;

  @IsString()
  public password!: string;
}
```

Service không nhận trực tiếp DTO.

Luồng:

```text
LoginRequestDto
    ↓
LoginInput
    ↓
AuthService
    ↓
LoginResult
    ↓
LoginResponseDto
```

---

# 11. Model

Model là dữ liệu nội bộ.

Ví dụ:

```ts
export type RefreshSession = {
  id: string;
  adminUserId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
};
```

Có thể hiểu gần giống `struct` trong C/C++.

Model không phụ thuộc HTTP.

Model không phải DTO.

---

# 12. Input và Result

Input nghiệp vụ:

```text
XxxInput
```

Kết quả nghiệp vụ:

```text
XxxResult
```

Ví dụ:

```ts
export type LoginInput = {
  username: string;
  password: string;
};

export type LoginResult = {
  accessToken: string;
  admin: AdminUser;
};
```

---

# 13. Không tạo abstraction quá sớm

Không mặc định tạo:

```text
Port
Adapter
BaseRepository
BaseService
GenericCrudService
AbstractController
Factory
Manager
Handler
Provider
```

nếu chưa có lý do kỹ thuật.

Ví dụ được phép:

```text
AuthService
    ↓
AccessTokenService
    ↓
JWT
```

```text
AuthService
    ↓
PasswordHasherService
    ↓
Argon2
```

```text
AuthService
    ↓
AuthRepository
    ↓
Prisma
```

Không cần bắt buộc:

```text
AccessTokenPort
JwtAccessTokenAdapter
```

chỉ để đúng một pattern kiến trúc.

---

# 14. Security service

Các công nghệ bảo mật riêng của Auth có thể đặt trong:

```text
auth/
└── security/
    ├── access-token.service.ts
    ├── refresh-token.service.ts
    └── password-hasher.service.ts
```

`access-token.service.ts` được phép biết JWT.

`password-hasher.service.ts` được phép biết Argon2.

`refresh-token.service.ts` chịu trách nhiệm tạo/hash refresh token.

---

# 15. Authentication và Authorization

Hai khái niệm:

```text
Authentication
= Anh là ai?

Authorization
= Anh được phép làm gì?
```

Nếu project có phân quyền, đặt trong module `auth`.

Ví dụ:

```text
auth/
├── guards/
│   ├── authentication.guard.ts
│   └── authorization.guard.ts
│
├── decorators/
│   └── require-permissions.decorator.ts
│
├── constants/
│   └── permissions.constant.ts
│
└── models/
    ├── authenticated-user.model.ts
    └── permission.model.ts
```

Luồng:

```text
Request
  ↓
AuthenticationGuard
  ↓
AuthorizationGuard
  ↓
Controller
  ↓
Service
```

Ưu tiên permission khi cần phân quyền chi tiết.

Ví dụ:

```text
ARTWORK_READ
ARTWORK_CREATE
ARTWORK_UPDATE
ARTWORK_DELETE
```

Role có thể là tập hợp permission.

---

# 16. Database

Cấu trúc:

```text
database/
├── database.module.ts
└── prisma.service.ts
```

Chỉ có một PrismaService dùng chung.

Không tạo `PrismaClient` riêng trong từng module.

Không đọc `process.env` trực tiếp trong repository.

---

# 17. Config

Cấu trúc:

```text
config/
├── app.config.ts
├── auth.config.ts
├── database.config.ts
└── config.module.ts
```

Không dùng:

```ts
process.env.SOMETHING
```

rải rác trong project.

Environment variable phải được đọc và kiểm tra ở config layer.

Config phải được validate khi application khởi động.

---

# 18. Common

`common/` chỉ chứa thành phần thật sự dùng chung.

Ví dụ:

```text
common/
├── constants/
├── decorators/
├── filters/
├── guards/
├── interceptors/
└── types/
```

Quy tắc:

```text
chỉ một module dùng
→ để trong module đó

nhiều module dùng
→ common/
```

Không biến `common/` thành nơi chứa mọi thứ.

---

# 19. Không tạo helper mơ hồ

Cấm các file kiểu:

```text
utils.ts
helpers.ts
misc.ts
common-utils.ts
```

Tên file phải cho biết chính xác nhiệm vụ.

Ví dụ:

```text
date-parser.ts
token-hasher.service.ts
pagination.type.ts
```

---

# 20. Filter

Filter dùng để chuẩn hóa lỗi.

Ví dụ:

```text
common/
└── filters/
    └── global-exception.filter.ts
```

Không viết cùng một `try/catch` trong mọi controller.

Error response phải có format thống nhất.

Ví dụ:

```json
{
  "statusCode": 401,
  "code": "AUTH_INVALID_CREDENTIALS",
  "message": "Invalid credentials"
}
```

---

# 21. Guard

Guard dùng để quyết định request có được đi tiếp hay không.

Ví dụ:

```text
authentication.guard.ts
authorization.guard.ts
```

Guard riêng của Auth đặt trong:

```text
modules/auth/guards/
```

Guard thực sự dùng chung mới đưa vào:

```text
common/guards/
```

---

# 22. Interceptor

Interceptor dùng cho các cơ chế bao quanh request/response.

Ví dụ:

```text
request logging
request ID
đo thời gian xử lý
response wrapping
```

Không đưa nghiệp vụ vào interceptor.

---

# 23. Constants

Constant riêng module:

```text
modules/auth/constants/
```

Constant toàn hệ thống:

```text
common/constants/
```

Không dùng magic number/magic string.

Không viết:

```ts
if (attempts > 5) {
```

Nên viết:

```ts
const MAXIMUM_LOGIN_ATTEMPTS: number = 5;

if (attempts > MAXIMUM_LOGIN_ATTEMPTS) {
```

---

# 24. Class và type

Dùng `class` khi cần:

```text
NestJS dependency injection
decorator
object có behavior
```

Ví dụ:

```ts
@Injectable()
export class AuthService {
}
```

DTO dùng class:

```ts
export class LoginRequestDto {
}
```

Dữ liệu thuần dùng `type`:

```ts
export type LoginInput = {
  username: string;
  password: string;
};
```

Mặc định ưu tiên `type`.

Không lúc dùng `interface`, lúc dùng `type` một cách ngẫu nhiên.

---

# 25. Bố cục class

Class phải có thứ tự cố định:

```text
1. static readonly constants
2. readonly fields
3. mutable fields
4. constructor
5. public methods
6. protected methods
7. private methods
```

Ví dụ:

```ts
@Injectable()
export class AuthService {
  private static readonly MAXIMUM_LOGIN_ATTEMPTS: number = 5;

  private readonly authRepository: AuthRepository;
  private readonly passwordHasherService: PasswordHasherService;

  private failedLoginAttempts: number;

  constructor(authRepository: AuthRepository, passwordHasherService: PasswordHasherService) {
    this.authRepository = authRepository;
    this.passwordHasherService = passwordHasherService;
    this.failedLoginAttempts = 0;
  }

  public async login(input: LoginInput): Promise<LoginResult> {
    // ...
  }

  public async logout(input: LogoutInput): Promise<void> {
    // ...
  }

  private async findActiveUser(username: string): Promise<AdminUser | null> {
    // ...
  }

  private isUserLocked(user: AdminUser): boolean {
    // ...
  }
}
```

---

# 26. Constructor

Không dùng constructor parameter property shorthand.

Không viết:

```ts
constructor(
  private readonly authRepository: AuthRepository,
  private readonly accessTokenService: AccessTokenService,
) {
}
```

Viết:

```ts
private readonly authRepository: AuthRepository;
private readonly accessTokenService: AccessTokenService;

constructor(authRepository: AuthRepository, accessTokenService: AccessTokenService) {
  this.authRepository = authRepository;
  this.accessTokenService = accessTokenService;
}
```

Field, parameter và assignment phải nhìn thấy rõ.

---

# 27. Quy chuẩn khai báo hàm

Nếu khai báo vừa một dòng, giữ trên một dòng.

Ví dụ:

```ts
public async login(input: LoginInput): Promise<LoginResult> {
```

```ts
private isSessionExpired(session: RefreshSession, currentTime: Date): boolean {
```

Không tự xuống dòng chỉ vì formatter thích.

Nếu dòng thực sự quá dài mới xuống:

```ts
public async createRefreshSession(
  input: CreateRefreshSessionInput,
): Promise<RefreshSession> {
```

Dấu `{` luôn cùng dòng với phần kết thúc declaration.

Không viết:

```ts
public login(): LoginResult
{
}
```

---

# 28. Access modifier

Method trong class phải ghi rõ:

```text
public
protected
private
```

Không dựa vào mặc định `public`.

Viết:

```ts
public async login(input: LoginInput): Promise<LoginResult> {
```

Không viết:

```ts
async login(input: LoginInput): Promise<LoginResult> {
```

---

# 29. Return type

Mọi function/method phải có return type.

Ví dụ:

```ts
public getUser(): AdminUser {
```

```ts
public async getUser(): Promise<AdminUser> {
```

```ts
public logout(): void {
```

Không để TypeScript tự suy luận return type cho method nghiệp vụ.

---

# 30. Biến

Ưu tiên type tường minh cho biến nghiệp vụ.

Ví dụ:

```ts
const currentTime: Date = new Date();

const tokenHash: string = this.refreshTokenService.hash(rawToken);

const session: RefreshSession | null =
  await this.authRepository.findRefreshSessionByTokenHash(tokenHash);

const passwordMatches: boolean =
  await this.passwordHasherService.verify(input.password, user.passwordHash);
```

Mặc định dùng:

```ts
const
```

Chỉ dùng `let` khi biến thực sự được gán lại.

Cấm:

```ts
var
```

Không bắt buộc ghi type cho mọi biến cực kỳ hiển nhiên nếu làm code nhiễu, nhưng biến mang ý nghĩa nghiệp vụ nên ghi rõ type.

---

# 31. Naming

Tên phải đầy đủ và thể hiện ý nghĩa.

Không dùng các tên rút gọn như:

```text
usr
pwd
repo
res
req
tmp
obj
val
cfg
ctx
```

Ưu tiên:

```text
user
password
repository
response
request
temporaryFile
object
value
configuration
context
```

Các acronym tiêu chuẩn được phép:

```text
DTO
URL
HTTP
JWT
API
ID
```

---

# 32. Boolean naming

Boolean phải có tên thể hiện câu hỏi.

Ví dụ:

```text
isActive
isExpired
hasPermission
canDelete
shouldRotate
mustChangePassword
```

Không dùng:

```text
flag
check
status
value
```

cho boolean nếu có thể đặt tên rõ hơn.

---

# 33. null và undefined

Kiểm tra tường minh.

Nếu type:

```ts
AdminUser | null
```

thì:

```ts
if (user === null) {
```

Không:

```ts
if (!user) {
```

Nếu type:

```ts
string | undefined
```

thì:

```ts
if (rawToken === undefined) {
```

Quy ước:

```text
null
= đã tìm nhưng không tồn tại

undefined
= không được cung cấp/chưa được xác định
```

Không dùng cả hai cho cùng một ý nghĩa.

---

# 34. Không dùng ternary

Cấm:

```ts
const status: string = enabled ? 'enabled' : 'disabled';
```

Viết:

```ts
let status: string;

if (enabled === true) {
  status = 'enabled';
} else {
  status = 'disabled';
}
```

---

# 35. Không dùng logical operator thay control flow

Không viết:

```ts
isValid && save();
```

Viết:

```ts
if (isValid === true) {
  save();
}
```

Không dùng `&&` hoặc `||` để che luồng điều khiển.

---

# 36. Không ép boolean rút gọn

Không viết:

```ts
const exists: boolean = !!user;
```

Viết:

```ts
const exists: boolean = user !== null;
```

---

# 37. Luôn dùng braces

Mọi block phải có `{}`.

Áp dụng cho:

```text
if
else
for
while
try
catch
```

Viết:

```ts
if (user === null) {
  return null;
}
```

Không viết:

```ts
if (user === null) return null;
```

---

# 38. Ưu tiên early return

Không tạo nhiều tầng `if`.

Không nên:

```ts
if (session !== null) {
  if (session.revokedAt === null) {
    if (session.expiresAt > currentTime) {
      // logic
    }
  }
}
```

Nên:

```ts
if (session === null) {
  return null;
}

if (session.revokedAt !== null) {
  return null;
}

if (session.expiresAt <= currentTime) {
  return null;
}

// logic chính
```

---

# 39. Không viết điều kiện quá phức tạp

Không gom nhiều điều kiện nghiệp vụ/bảo mật thành một expression khó đọc.

Ưu tiên kiểm tra từng điều kiện riêng.

Mục tiêu là khi debug có thể biết chính xác điều kiện nào thất bại.

---

# 40. Không lạm dụng functional style

Không ưu tiên các chuỗi:

```ts
items
  .filter(...)
  .map(...)
  .flatMap(...)
  .reduce(...);
```

nếu làm luồng xử lý khó theo dõi.

Ưu tiên `for...of` khi logic có nhiều bước hoặc có side effect.

Ví dụ:

```ts
for (const item of items) {
  // xử lý rõ ràng
}
```

---

# 41. Arrow function

Không dùng arrow function thay method của class.

Không:

```ts
public login = async (input: LoginInput): Promise<LoginResult> => {
};
```

Viết:

```ts
public async login(input: LoginInput): Promise<LoginResult> {
}
```

Callback đơn giản vẫn được dùng arrow function nếu library/API cần.

---

# 42. Không implicit return cho callback có logic

Không nên:

```ts
items.map((item) => transform(item));
```

nếu callback có ý nghĩa nghiệp vụ.

Nên:

```ts
items.map((item) => {
  const result: ItemResult = transform(item);

  return result;
});
```

---

# 43. Object phải tường minh

Ưu tiên:

```ts
const result: LoginResult = {
  accessToken: accessToken,
  admin: admin,
};
```

thay vì:

```ts
const result: LoginResult = {
  accessToken,
  admin,
};
```

Đặc biệt tại boundary giữa các tầng.

---

# 44. Nhiều tham số

Nếu function có nhiều tham số hoặc dễ nhầm thứ tự, dùng input object.

Không nên:

```ts
public createSession(
  userId: string,
  familyId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<RefreshSession> {
}
```

Nên:

```ts
public createSession(input: CreateSessionInput): Promise<RefreshSession> {
}
```

---

# 45. any

Cấm:

```ts
any
```

Nếu chưa biết type:

```ts
unknown
```

sau đó kiểm tra trước khi sử dụng.

Hạn chế:

```ts
as SomeType
```

Không dùng type assertion chỉ để làm compiler im lặng.

---

# 46. Tên file

File dùng `kebab-case`.

Ví dụ:

```text
auth.service.ts
auth.repository.ts
access-token.service.ts
refresh-session.model.ts
login.request.dto.ts
login.response.dto.ts
```

Không dùng:

```text
AuthService.ts
authService.ts
auth_service.ts
```

---

# 47. Tên class, function, variable

Class:

```text
PascalCase
```

Ví dụ:

```text
AuthService
AuthRepository
AccessTokenService
```

Function/method/variable:

```text
camelCase
```

Ví dụ:

```text
findAdminByUsername
rotateRefreshSession
currentTime
tokenHash
```

---

# 48. ID naming

Thống nhất:

```text
adminUserId
sessionId
familyId
artworkId
categoryId
```

Không dùng lẫn:

```text
userID
user_id
uid
```

---

# 49. Import/export

Không dùng default export.

Không:

```ts
export default AuthService;
```

Viết:

```ts
export class AuthService {
}
```

Không dùng wildcard import nếu không cần.

Không tạo hàng loạt `index.ts` chỉ để rút ngắn import.

Ưu tiên import trực tiếp từ file định nghĩa.

---

# 50. Error

Không throw string.

Không:

```ts
throw 'Invalid user';
```

Error phải là object/class rõ ràng.

Error code cho frontend phải ổn định.

Ví dụ:

```text
AUTH_INVALID_CREDENTIALS
AUTH_REFRESH_TOKEN_REUSED
VALIDATION_FAILED
RESOURCE_NOT_FOUND
```

Không dùng HTTP status code thay thế hoàn toàn cho application error code.

HTTP status và error code có vai trò khác nhau.

---

# 51. Logging

Không dùng:

```ts
console.log()
console.error()
```

trong production code.

Dùng logger thống nhất.

Tuyệt đối không log:

```text
password
passwordHash
raw refresh token
access token
JWT secret
private key
authentication cookie
```

---

# 52. Validation

Mọi dữ liệu từ bên ngoài phải được kiểm tra tại boundary.

Bao gồm:

```text
body
query
param
header quan trọng
file upload
environment variable
external API response
```

HTTP sử dụng DTO + validation.

Không tin dữ liệu client gửi lên.

---

# 53. Comment

Comment dùng để giải thích:

```text
Tại sao phải làm như vậy?
```

Không comment điều code đã nói rõ.

Không:

```ts
// Find user
const user: AdminUser | null = await this.authRepository.findUser(...);
```

Có thể:

```ts
// Reuse of a rotated refresh token may indicate token theft,
// therefore the remaining token family must be revoked.
```

---

# 54. Auth token

Access token và refresh token có trách nhiệm khác nhau.

Access token:

```text
sống ngắn
dùng để gọi API
```

Refresh token:

```text
sống dài hơn
dùng để xin access token mới
lưu trong HttpOnly cookie
```

Refresh token phải lưu dưới dạng hash trong database.

Không lưu raw refresh token trong database.

---

# 55. Refresh token rotation

Mỗi lần refresh thành công:

```text
refresh token cũ
→ revoke/rotate
→ tạo refresh token mới
→ tạo access token mới
```

Session cũ phải lưu:

```text
revokedAt
revokedReason
replacedById
lastUsedAt
```

Session mới giữ cùng:

```text
familyId
adminUserId
fingerprintHash
```

nhưng có:

```text
sessionId mới
tokenHash mới
expiresAt mới
```

Không query chỉ session `revokedAt = null` ngay từ đầu nếu hệ thống cần phát hiện token reuse.

Phải tìm được token cũ đã rotate để phát hiện reuse.

---

# 56. Refresh token reuse detection

Nếu refresh token cũ đã được rotate nhưng lại được gửi lại:

```text
đây là refresh token reuse
```

Hệ thống phải coi đây là sự kiện bảo mật.

Có thể revoke toàn bộ token family tùy chính sách.

Không chỉ đơn giản trả 401 mà không ghi nhận nguyên nhân.

---

# 57. Cookie

Refresh token đặt trong cookie:

```text
HttpOnly
Secure
SameSite phù hợp
Max-Age/Expires theo expiresAt
```

Access token trả trong response JSON nếu frontend dùng Bearer token.

Response auth nhạy cảm nên có:

```text
Cache-Control: no-store
Pragma: no-cache
```

Helmet không thay thế hai header cache này.

---

# 58. Password

Password phải hash bằng thuật toán chuyên dụng như Argon2.

Không dùng hash thông thường như SHA-256 trực tiếp để lưu password.

Change password phải:

```text
xác thực yêu cầu hợp lệ
hash password mới
update passwordHash
mustChangePassword = false nếu phù hợp
revoke toàn bộ refresh session đang hoạt động
```

Nếu nghiệp vụ yêu cầu nhập mật khẩu cũ thì Service phải verify mật khẩu cũ trước khi thay đổi.

---

# 59. Prisma

Prisma chỉ xuất hiện trong:

```text
repository
database layer
```

Không để Prisma model/type đi ra Service/Controller.

Query nên dùng `select` rõ ràng khi không cần toàn bộ record.

Không lấy cả row nếu chỉ cần một số field.

---

# 60. Pagination

Các endpoint danh sách phải dùng pagination contract thống nhất.

Ví dụ:

```ts
export type Pagination = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

export type PaginatedData<T> = {
  items: T[];
  pagination: Pagination;
};
```

Không mỗi module tự nghĩ ra format pagination riêng.

---

# 61. API response

Response phải có contract rõ ràng.

Không trả raw Prisma model.

Không để field nội bộ như:

```text
passwordHash
tokenHash
internal flags
```

lọt ra response.

---

# 62. Swagger/OpenAPI

Swagger/OpenAPI dùng để mô tả API.

Không coi Swagger là logic nghiệp vụ.

Production có thể:

```text
tắt Swagger
giới hạn truy cập
đặt sau authentication
```

tùy yêu cầu bảo mật.

Việc bật Swagger không được làm thay đổi API contract thực tế.

---

# 63. main.ts

`main.ts` là điểm khởi động application.

Có thể hiểu gần như:

```cpp
int main()
```

Trong `main.ts` chỉ đặt bootstrap/configuration cấp application.

Ví dụ:

```text
global prefix
global validation pipe
CORS
Helmet
cookie parser
logger
global filter/interceptor
listen port
```

Không đặt nghiệp vụ trong `main.ts`.

---

# 64. app.module.ts

`app.module.ts` là module gốc.

Chỉ có nhiệm vụ ghép các module lớn:

```text
ConfigModule
DatabaseModule
AuthModule
ArtworksModule
CategoriesModule
...
```

Không đặt logic nghiệp vụ trong `AppModule`.

---

# 65. Module file

`xxx.module.ts` chỉ dùng để wiring dependency của module đó.

Ví dụ:

```text
controllers
providers
imports
exports
```

Không đặt nghiệp vụ trong file module.

---

# 66. ESM

Project dùng ESM.

Dùng:

```ts
import { Module } from '@nestjs/common';
```

Không dùng CommonJS:

```ts
const nestCommon = require('@nestjs/common');
```

Không trộn ESM và CJS tùy tiện.

---

# 67. Test

Project dùng Vitest.

Test chia theo loại khi cần:

```text
unit test
integration test
e2e test
```

Không mock mọi thứ một cách máy móc.

Ưu tiên test nghiệp vụ quan trọng:

```text
login
refresh token rotation
reuse detection
change password
permission checks
repository transaction
```

---

# 68. Coding style cho test

Test vẫn phải theo cùng coding style:

```text
tên rõ ràng
không viết tắt tùy tiện
không ternary
không any
return type rõ khi phù hợp
```

Tên test phải mô tả hành vi bằng tiếng việt không dấu.

Ví dụ:

```ts
it('.........................', async () => {
});
```

---

# 69. ESLint và formatter

ESLint dùng để bắt lỗi và enforce coding rules.

Formatter không được tự ý phá coding style đã thống nhất.

Đặc biệt:

```text
không bắt method declaration phải xuống nhiều dòng nếu không cần
không ép brace xuống dòng
```

Coding style của project ưu tiên:

```ts
public async login(input: LoginInput): Promise<LoginResult> {
```

không phải:

```ts
public async login(
  input: LoginInput,
): Promise<LoginResult> {
```

nếu dòng vẫn đọc tốt.

---

# 70. Brace style

Dấu `{` đặt cùng dòng.

Ví dụ:

```ts
export class AuthService {
```

```ts
public async login(input: LoginInput): Promise<LoginResult> {
```

```ts
if (user === null) {
```

```ts
for (const session of sessions) {
```

```ts
try {
```

Không dùng Allman style.

---

# 71. Code phải tường minh, không nhất thiết ngắn

Mục tiêu là:

```text
tường minh về type
tường minh về tên
tường minh về luồng
```

Không coi ít dòng hơn là tốt hơn.

Ví dụ ưu tiên:

```ts
const tokenHash: string = this.refreshTokenService.hash(input.rawToken);
```

thay vì viết rút gọn khó theo dõi.

---

# 72. Không dùng shorthand nếu làm mất tính tường minh

Ở boundary hoặc object nghiệp vụ quan trọng:

```ts
const result: LoginResult = {
  accessToken: accessToken,
  admin: admin,
};
```

được ưu tiên hơn:

```ts
const result: LoginResult = {
  accessToken,
  admin,
};
```

---

# 73. Quy tắc cho AI

AI phải tuân theo tài liệu này.

Trước khi viết code mới, AI phải:

```text
1. Xem các file tương tự hiện có.
2. Tuân theo pattern hiện tại nếu phù hợp tài liệu này.
3. Không tự tạo kiến trúc mới.
4. Không thêm abstraction không cần thiết.
5. Không tự thêm library nếu chưa cần.
6. Không thay naming convention.
7. Không dùng ternary.
8. Không dùng any.
9. Không dùng constructor shorthand.
10. Method phải có access modifier.
11. Method phải có return type.
12. Ưu tiên explicit type cho biến nghiệp vụ.
13. Không tự refactor phần ngoài yêu cầu.
14. Không tự thay API contract.
15. Không viết tắt tên biến cho nhanh.
```

Nếu project có hai pattern khác nhau, AI không được tự chọn ngẫu nhiên.

Phải báo rõ:

```text
Hiện có hai pattern:

Pattern A: ...
Pattern B: ...

Theo PROJECT_RULES.md nên thống nhất về: ...
```

---

# 74. Quy tắc khi thêm feature mới

Khi thêm một feature mới:

```text
1. Xác định module chứa feature.
2. Xác định HTTP input/output.
3. Tạo DTO.
4. Xác định model nội bộ.
5. Viết Service nghiệp vụ.
6. Viết Repository nếu cần database.
7. Controller chỉ gọi Service.
8. Thêm validation.
9. Thêm permission nếu cần.
10. Thêm test.
11. Không tạo abstraction ngoài nhu cầu.
```

---

# 75. Quy tắc khi thêm library

Trước khi thêm library phải trả lời được:

```text
Library này giải quyết vấn đề gì?
NestJS/Node hiện tại có làm được không?
Project đã có library tương đương chưa?
Library này có ảnh hưởng kiến trúc không?
Có cần thêm config/bảo trì không?
```

Không thêm package chỉ vì tutorial dùng.

---

# 76. Quy tắc khi refactor

Refactor phải giữ:

```text
API contract
business behavior
security behavior
database integrity
test pass
```

Không refactor nhiều khu vực không liên quan trong cùng một thay đổi nếu không cần.

---

# 77. Quy tắc khi review code

Khi review phải kiểm tra ít nhất:

```text
file có đúng vị trí không
controller có chứa nghiệp vụ không
service có gọi Prisma không
repository có chứa nghiệp vụ không
DTO có bị dùng sâu vào service không
Prisma type có leak ra ngoài không
có any không
có ternary không
có tên viết tắt không
có magic value không
có log secret không
auth/permission có đúng không
transaction có cần không
error code có ổn định không
test có thiếu trường hợp bảo mật không
```

---

# 78. Công thức cần nhớ

Cấp project:

```text
src/
├── modules/       ← nghiệp vụ
├── database/      ← database
├── config/        ← cấu hình
├── common/        ← dùng chung
├── app.module.ts  ← ghép application
└── main.ts        ← khởi động
```

Trong module:

```text
xxx/
├── xxx.controller.ts   ← HTTP
├── xxx.service.ts      ← nghiệp vụ
├── xxx.repository.ts   ← database
├── dto/                ← HTTP data
├── models/             ← internal data
├── phần đặc thù/       ← khi cần
└── xxx.module.ts       ← wiring
```

Luồng:

```text
Request
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

Auth:

```text
AuthService
├── AccessTokenService
├── RefreshTokenService
├── PasswordHasherService
└── AuthRepository
      ↓
    Prisma
      ↓
    MySQL
```

---

# 79. Nguyên tắc cuối cùng

Một developer khi nhìn tên file phải đoán được file làm gì.

Một developer khi biết chức năng phải đoán được file nằm ở đâu.

Một developer khi mở method phải nhìn thấy rõ:

```text
input là gì
type là gì
điều kiện nào được kiểm tra
service nào được gọi
repository nào được gọi
kết quả là gì
return type là gì
```

Không bắt người đọc phải suy luận những thứ có thể viết tường minh.

Không viết TypeScript để chứng minh TypeScript có thể viết ngắn.

Viết TypeScript để người khác có thể đọc, kiểm tra, debug và sửa hệ thống một cách chắc chắn.
