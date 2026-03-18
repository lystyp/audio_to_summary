# 音訊轉錄與摘要服務

上傳音訊檔案，系統自動進行語音轉文字（Google Cloud Speech-to-Text v2）並以 Gemini LLM 產生摘要。結果可透過 SSE 即時串流或直接查詢取得。

---

## 專案介紹

### 系統概覽

這是一個以 **pnpm monorepo** 組織的非同步音訊處理服務，包含三個主要套件：

| 套件 | 路徑 | 說明 |
|------|------|------|
| `@daniel/server` | `apps/server/` | Express 5 REST API，接收上傳、提供查詢、SSE 串流 |
| `@daniel/worker` | `apps/worker/` | 背景 Worker，消費 RabbitMQ 佇列並呼叫 GCP 服務 |
| `@daniel/shared` | `packages/shared/` | 共用工具：Config、Prisma、RabbitMQ、GCS |

### 處理流程

```
使用者上傳音訊
      ↓
API 存入 GCS + 建立 DB 記錄 (PENDING) + 推送至 RabbitMQ
      ↓
Worker 消費佇列
      ↓
Google Cloud STT (Batch Recognize, Chirp 2) → transcript
      ↓
Gemini API → summary
      ↓
DB 更新為 COMPLETED（或 FAILED）
      ↓
API SSE 推送最新狀態給客戶端
```

### 任務狀態流程

```
PENDING → PROCESSING → COMPLETED
                     ↘ FAILED（可呼叫 retry 重試）
```

### 架構圖

```mermaid
sequenceDiagram
    participant Client
    participant API as API (Express 5)
    participant GCS as Google Cloud Storage
    participant MQ as RabbitMQ
    participant Worker
    participant STT as Google STT (Chirp 2)
    participant LLM as Gemini API
    participant DB as PostgreSQL

    Client->>API: POST /api/jobs (multipart/form-data)
    API->>GCS: 上傳音訊檔
    API->>DB: INSERT Job (PENDING)
    API->>MQ: publish jobs queue
    API-->>Client: 202 { jobId, status: "PENDING" }

    Client->>API: GET /api/jobs/:id/events (SSE)
    API-->>Client: data: { status: "PENDING" }

    MQ->>Worker: consume job
    Worker->>DB: UPDATE → PROCESSING
    Worker->>STT: Batch Recognize (GCS URI)
    STT-->>Worker: transcript
    Worker->>LLM: generateContent(transcript)
    LLM-->>Worker: summary
    Worker->>DB: UPDATE → COMPLETED + transcript + summary

    Note over API,Client: SSE polling DB 每秒
    API-->>Client: data: { status: "COMPLETED", transcript, summary }
```

### 技術棧

| 層次 | 技術 |
|------|------|
| Runtime | Node.js 20+、TypeScript (strict) |
| API Framework | Express 5 |
| API 文件 | `@asteasolutions/zod-to-openapi` + Swagger UI |
| 驗證 | Zod（schema-first，同時作為 TypeScript 型別與 OpenAPI 來源） |
| ORM | Prisma 5 + PostgreSQL 16 |
| 訊息佇列 | RabbitMQ 3（durable queue，prefetch=1） |
| 物件儲存 | Google Cloud Storage |
| 語音轉文字 | Google Cloud Speech-to-Text v2（Chirp 2，Batch Recognize） |
| LLM 摘要 | Google Gemini API（gemini-2.0-flash-lite） |
| 容器化 | Docker（multi-stage build）+ docker-compose |
| 套件管理 | pnpm 9（workspace monorepo） |

---

## 環境需求與啟動方式

### 環境需求

- **Docker** 與 **Docker Compose** v2+
- **GCP 服務帳號**，需具備以下 API 權限：
  - Google Cloud Storage（讀寫）
  - Cloud Speech-to-Text v2
- **Gemini API Key**（Google AI Studio 申請）
- **GCS Bucket**（需事先建立）

### 環境變數

複製 `.env.example` 並填入設定：

```bash
cp .env.example .env
```

| 環境變數 | 必填 | 說明 | 預設值 |
|----------|------|------|--------|
| `DATABASE_URL` | ✅ | PostgreSQL 連線字串 | `postgresql://app:secret@localhost:5432/transcriptions` |
| `RABBITMQ_URL` | ✅ | RabbitMQ 連線字串 | `amqp://guest:guest@localhost:5672` |
| `GCS_BUCKET` | ✅ | GCS bucket 名稱 | — |
| `GEMINI_API_KEY` | ✅ | Gemini API 金鑰 | — |
| `POSTGRES_USER` | — | PostgreSQL 使用者名稱 | `app` |
| `POSTGRES_PASSWORD` | — | PostgreSQL 密碼 | `secret` |
| `POSTGRES_DB` | — | PostgreSQL 資料庫名稱 | `transcriptions` |
| `STT_LANGUAGE_CODE` | — | STT 主要語言代碼 | `cmn-Hant-TW` |
| `MAX_FILE_SIZE_MB` | — | 上傳檔案大小上限（MB） | `100` |
| `PORT` | — | API 監聽埠 | `3000` |
| `NODE_ENV` | — | 執行環境 | `local` |
| `GOOGLE_APPLICATION_CREDENTIALS` | — | GCP Service Account 金鑰路徑（由 docker-compose.local.yml 自動注入） | — |

### GCP 憑證設定

```bash
mkdir -p secrets
cp /path/to/your-gcp-service-account-key.json secrets/gcp-key.json
```

> `secrets/gcp-key.json` 已列於 `.gitignore`，不會被提交到版本控制。

### 啟動方式

#### Docker 啟動（建議）

```bash
# 本機開發（自動掛載 GCP 憑證）
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build

# 背景執行
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build -d
```

啟動後可存取的服務：

| 服務 | 網址 |
|------|------|
| 前端介面 | http://localhost:3000 |
| Swagger UI | http://localhost:3000/docs |
| RabbitMQ 管理介面 | http://localhost:15672（guest / guest） |

#### 本機開發（不用 Docker）

需先確保本機有 PostgreSQL 與 RabbitMQ，或只啟動依賴服務：

```bash
# 只啟動 PostgreSQL 和 RabbitMQ
docker compose up postgres rabbitmq -d

# 安裝依賴
pnpm install

# 執行資料庫 migration
pnpm migrate:local

# Terminal 1：啟動 API server
pnpm dev:server

# Terminal 2：啟動 Worker
pnpm dev:worker
```

#### 可用的 pnpm scripts

| 指令 | 說明 |
|------|------|
| `pnpm dev:server` | 啟動 API server（hot reload） |
| `pnpm dev:worker` | 啟動 Worker（hot reload） |
| `pnpm build` | 建置所有套件 |
| `pnpm migrate:local` | 執行本機 Prisma migration |
| `pnpm migrate:prd` | 執行正式環境 Prisma migration |
| `pnpm dbgui:local` | 開啟 Prisma Studio（本機 DB） |

---

## API 說明

互動式文件可至 **http://localhost:3000/docs** 查看 Swagger UI。

所有回應統一格式：

```json
// 成功
{ "success": true, "data": { ... } }

// 失敗
{ "success": false, "error": { "code": "ERROR_CODE", "message": "..." } }
```

---

### POST /api/jobs

**上傳音訊檔案，建立轉錄任務**

- Content-Type: `multipart/form-data`
- 支援格式：`.mp3`、`.wav`、`.ogg`、`.m4a`
- 檔案大小上限：`MAX_FILE_SIZE_MB`（預設 100 MB）

**Request**

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `audio` | File | ✅ | 音訊檔案 |

**Response `202`**

```json
{
  "success": true,
  "data": {
    "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "PENDING"
  }
}
```

**錯誤回應**

| HTTP 狀態碼 | code | 原因 |
|-------------|------|------|
| `400` | `INVALID_FILE_TYPE` | 不支援的音訊格式 |
| `400` | `LIMIT_FILE_SIZE` | 超過檔案大小限制 |
| `500` | `INTERNAL_ERROR` | 伺服器錯誤 |

**範例**

```bash
curl -X POST http://localhost:3000/api/jobs \
  -F "audio=@recording.mp3"
```

---

### GET /api/jobs

**列出所有任務（支援分頁與狀態篩選）**

**Query 參數**

| 參數 | 型別 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| `page` | integer | — | `1` | 頁碼（從 1 開始） |
| `limit` | integer | — | `20` | 每頁筆數（上限 100） |
| `status` | string | — | — | 篩選狀態：`PENDING`、`PROCESSING`、`COMPLETED`、`FAILED` |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "originalName": "meeting.mp3",
        "status": "COMPLETED",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:32:15.000Z"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

**範例**

```bash
# 取得第 1 頁，每頁 10 筆
curl "http://localhost:3000/api/jobs?page=1&limit=10"

# 只看失敗的任務
curl "http://localhost:3000/api/jobs?status=FAILED"

# 只看已完成，第 2 頁
curl "http://localhost:3000/api/jobs?status=COMPLETED&page=2"
```

---

### GET /api/jobs/:id

**查詢單一任務詳情**

**Path 參數**

| 參數 | 型別 | 說明 |
|------|------|------|
| `id` | UUID | 任務 ID |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "originalName": "meeting.mp3",
    "storagePath": "gs://my-bucket/audio/uuid.mp3",
    "status": "COMPLETED",
    "transcript": "今天的會議主要討論了 Q4 的業務目標...",
    "summary": "本次會議重點：1. Q4 業務目標設定 2. 預算分配討論 3. 行動方案確認",
    "errorMessage": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:32:15.000Z"
  }
}
```

**錯誤回應**

| HTTP 狀態碼 | code | 原因 |
|-------------|------|------|
| `404` | `JOB_NOT_FOUND` | 找不到指定任務 |
| `500` | `INTERNAL_ERROR` | 伺服器錯誤 |

**範例**

```bash
curl http://localhost:3000/api/jobs/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

---

### GET /api/jobs/:id/events

**SSE 即時進度串流**

任務尚未完成時，保持連線並每秒推送最新狀態；完成或失敗後自動關閉串流。

- Content-Type: `text/event-stream`
- 若任務已為 `COMPLETED` 或 `FAILED`，直接回傳 JSON 後結束（不開啟 SSE 串流）

**Path 參數**

| 參數 | 型別 | 說明 |
|------|------|------|
| `id` | UUID | 任務 ID |

**SSE 事件格式**

```
data: {"id":"...","status":"PROCESSING","transcript":null,"summary":null,...}

data: {"id":"...","status":"COMPLETED","transcript":"轉錄文字...","summary":"摘要..."}
```

**範例**

```bash
# 使用 curl 監聽 SSE
curl -N http://localhost:3000/api/jobs/a1b2c3d4-e5f6-7890-abcd-ef1234567890/events

# 使用 JavaScript EventSource
const es = new EventSource('/api/jobs/JOB_ID/events');
es.onmessage = (e) => {
  const job = JSON.parse(e.data);
  console.log(job.status, job.transcript);
  if (job.status === 'COMPLETED' || job.status === 'FAILED') es.close();
};
```

---

### GET /api/jobs/:id/audio

**串流播放原始音訊檔案**

從 Google Cloud Storage 取得音訊並以串流方式回傳。

**Path 參數**

| 參數 | 型別 | 說明 |
|------|------|------|
| `id` | UUID | 任務 ID |

**Response Headers**

```
Content-Type: audio/mpeg        # 依原始副檔名決定
Content-Disposition: inline
```

**錯誤回應**

| HTTP 狀態碼 | code | 原因 |
|-------------|------|------|
| `404` | `JOB_NOT_FOUND` | 找不到指定任務 |

**範例**

```bash
# 下載音訊
curl http://localhost:3000/api/jobs/JOB_ID/audio -o output.mp3

# 在瀏覽器直接播放
# <audio src="/api/jobs/JOB_ID/audio" controls />
```

---

### POST /api/jobs/:id/retry

**重試失敗的任務**

僅允許 `status = FAILED` 的任務重試。重設為 `PENDING` 並重新推送至佇列。

**Path 參數**

| 參數 | 型別 | 說明 |
|------|------|------|
| `id` | UUID | 任務 ID |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "PENDING"
  }
}
```

**錯誤回應**

| HTTP 狀態碼 | code | 原因 |
|-------------|------|------|
| `400` | `JOB_NOT_RETRYABLE` | 任務狀態非 FAILED，無法重試 |
| `404` | `JOB_NOT_FOUND` | 找不到指定任務 |
| `500` | `INTERNAL_ERROR` | 伺服器錯誤 |

**範例**

```bash
curl -X POST http://localhost:3000/api/jobs/a1b2c3d4-e5f6-7890-abcd-ef1234567890/retry
```

---

## 資料庫 Schema

```
Job
├── id           String   (UUID, PK)
├── originalName String   (原始檔名)
├── storagePath  String   (GCS 路徑, gs://...)
├── status       Enum     (PENDING | PROCESSING | COMPLETED | FAILED)
├── transcript   String?  (STT 轉錄文字, 完成後填入)
├── summary      String?  (Gemini 摘要, 完成後填入)
├── errorMessage String?  (失敗原因)
├── createdAt    DateTime
└── updatedAt    DateTime
```
