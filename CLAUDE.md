# CLAUDE.md — Node.js Express API 專案

## 專案概述
使用 Express + TypeScript 建構的 REST API。
架構採用 Layered（Controller → Service → Repository），
設計上可無痛重構為 DDD 模組結構。
Swagger 文件透過 `@asteasolutions/zod-to-openapi` 以 schema-first 方式產生，Zod schema 是 response 型別、runtime 驗證與 OpenAPI 文件的唯一來源。

---

## 技術棧
- **Runtime**: Node.js 20+、TypeScript（strict mode）
- **Framework**: Express 5
- **Swagger**: `@asteasolutions/zod-to-openapi` + `swagger-ui-express`（schema-first，Zod schema 直接產生 OpenAPI spec）
- **驗證**: `zod`（schema 即 type，runtime 驗證與 OpenAPI 文件的唯一來源）
- **ORM**: Prisma
- **測試**: Vitest + Supertest
- **Linting**: ESLint + Prettier

---

## 分層架構規則

### Controller 層
- 唯一職責：解析 HTTP request → 呼叫 service → 格式化 HTTP response
- **禁止**含商業邏輯或直接呼叫 DB
- 錯誤一律用 `next(err)`，禁止 inline `res.status(500).json(...)`
- 每個 handler 控制在 30 行以內
```typescript
// ✅ 正確
export const getUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userService.findById(req.params.id);
    res.json(successResponse(user));
  } catch (err) {
    next(err);
  }
};

// ❌ 錯誤：商業邏輯混入 controller
export const getUser = async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json(user);
};
```

### Service 層
- 擁有所有商業邏輯與 orchestration
- 不知道 `req`、`res` 的存在
- 跨 entity 操作在 service 層協調，不在 repository 層
- 拋出 `AppError` 而非 HTTP status code
```typescript
// ✅ 正確
export class UserService {
  async findById(id: string): Promise<User> {
    const user = await userRepository.findById(id);
    if (!user) throw new AppError('USER_NOT_FOUND', 404);
    return user;
  }
}
```

### Repository 層
- 唯一職責：資料庫 CRUD，不含任何商業判斷
- 回傳 domain model（不直接暴露 Prisma 型別到上層）
- 查無資料回傳 `null`，不在此層拋錯
```typescript
// ✅ 正確
export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }
}
```

---

## Swagger / OpenAPI 規則

### 基本原則
- Swagger 文件**完全由 Zod schema 驅動**，禁止在 route 檔案寫 JSDoc `@swagger` 標注
- 所有 response schema 定義在 `src/schemas/`，使用 `.openapi()` 加入說明與範例
- 所有 route 的 OpenAPI 定義（request/response schema）在 `src/docs/registry.ts` 集中登記
- 新增或修改 API 時，schema 與 registry 路由定義**同步更新**，不可分開提交

### Response Schema 規範
每個回傳 JSON 的 endpoint 必須有對應的 Zod response schema，且 **`parse()` 必須放在 `res.json()` 前**：
```typescript
// ✅ 正確：schema 守在出口，確保多餘欄位不外洩、文件與實作一致
res.json(GetJobResponseSchema.parse({ success: true, data: job }));

// ❌ 錯誤：直接送出未驗證資料
res.json({ success: true, data: job });
```
非 JSON 端點（SSE、binary stream）不需要 parse。

### Schema 定義規範
每個欄位必須有 `.openapi({ description, example })`：
```typescript
// src/schemas/job.schema.ts
export const JobSchema = z.object({
  id: z.string().uuid().openapi({ description: '任務唯一識別碼', example: 'a1b2c3d4-...' }),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'])
    .openapi({ description: '任務處理狀態' }),
  createdAt: z.preprocess(
    v => v instanceof Date ? v.toISOString() : v,
    z.string().datetime(),
  ).openapi({ description: '建立時間 (ISO 8601)' }),
}).openapi('Job');
```

### Registry 路由定義規範
每個 endpoint 的 `registry.registerPath()` 必須包含：
1. `tags` — 功能分組
2. `summary` — 一句話說明
3. `description` — 業務規則（複雜端點必填）
4. `request.params` / `request.query` / `request.body` — 完整輸入描述
5. `responses` — 至少列出成功碼與 `500`

```typescript
// src/docs/registry.ts
registry.registerPath({
  method: 'get',
  path: '/api/jobs/{id}',   // OpenAPI 格式，不是 Express 的 :id
  tags: ['Jobs'],
  summary: '查詢單一任務詳情',
  request: {
    params: z.object({ id: z.string().uuid().openapi({ description: '任務 UUID' }) }),
  },
  responses: {
    200: { description: '任務詳情', content: { 'application/json': { schema: GetJobResponseSchema } } },
    404: { description: '找不到任務', content: { 'application/json': { schema: ErrorResponseSchema } } },
    500: { description: '伺服器錯誤', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
});
```

---

## DTO 與驗證規則

- 所有 request 輸入（body、query、params）**必須**透過 Zod schema 驗證
- Zod schema 定義在 `src/dtos/`，同一個 schema 同時作為：
  1. TypeScript 型別來源（`z.infer<typeof Schema>`）
  2. Runtime 驗證依據
  3. Swagger schema 的 reference 基礎
- 禁止用 `any`，禁止在 controller 手動做型別 assertion
```typescript
// src/dtos/user.dto.ts
export const CreateUserDto = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'user']).default('user'),
});

export type CreateUserInput = z.infer<typeof CreateUserDto>;
```

---

## 錯誤處理規則

- 所有自訂錯誤繼承 `AppError`，包含 `statusCode` 與 `code`（snake_case 常數）
- Service 層只拋 `AppError`，不使用裸露的 `Error`
- 全域 `errorHandler` middleware 統一格式化回應
- 非預期錯誤（非 `AppError`）在 errorHandler 中回傳 500，並 log 完整 stack
```typescript
// src/errors/AppError.ts
export class AppError extends Error {
  constructor(
    public code: string,       // e.g. 'USER_NOT_FOUND'
    public statusCode: number, // e.g. 404
    message?: string,
  ) {
    super(message ?? code);
  }
}
```

---

## API Response 格式

所有 response 統一使用 `src/utils/response.ts` 的 wrapper，格式如下：
```json
// 成功
{ "success": true, "data": { ... } }

// 失敗
{ "success": false, "error": { "code": "USER_NOT_FOUND", "message": "..." } }
```

禁止在各 controller 自行組裝 response 格式。

---

## 測試規則
- Unit test：service 層邏輯，mock repository
- Integration test：使用 Supertest 測試完整 HTTP 流程，含 middleware
- 每個新 endpoint 必須有對應的 integration test，覆蓋正常路徑與主要錯誤路徑
- 測試檔案與 source 對應：`src/services/user.service.ts` → `__tests__/unit/user.service.test.ts`

---

## 開發工作流程

新增一個 API endpoint 的標準步驟：
1. 在 `src/schemas/` 定義或更新 Zod response schema（含 `.openapi()` 說明）
2. 在 `src/repositories/` 實作資料存取方法
3. 在 `src/services/` 實作商業邏輯
4. 在 `src/routes/` 實作 handler，`res.json()` 前呼叫 `Schema.parse()`
5. 在 `src/docs/registry.ts` 新增對應的 `registry.registerPath()` 定義
6. 補上對應測試

嚴禁跳過步驟或將邏輯放入錯誤的層級。

---

## 禁止事項
- 禁止在 controller 直接 import Prisma client
- 禁止在 repository 寫 if/else 商業判斷
- 禁止 `any` 型別
- 禁止沒有在 `src/docs/registry.ts` 登記的 public endpoint
- 禁止在 route handler 直接 `res.json(rawData)`，一律透過 `Schema.parse()` 送出
- 禁止沒有 zod 驗證的 request input
- 禁止 `console.log`，統一使用 logger（`src/utils/logger.ts`）
```

---