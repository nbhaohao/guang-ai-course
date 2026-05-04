# guang-ai-course — 项目说明

## 项目结构

```
guang-ai-course/
├── mivlus/          # Milvus 向量数据库 + RAG 实践
└── memory-test/     # LangChain 对话记忆实践
```

---

## 工作约定

### DDD 分层架构（所有子项目统一遵循）

每个子项目使用三层结构：

| 层 | 职责 | 位置 |
|---|---|---|
| **Domain（领域层）** | 实体、值对象、仓储/服务接口 | `shared.mjs` 上半部分 |
| **Infrastructure（基础设施层）** | 接口的具体实现（Milvus、OpenAI、LangChain） | `shared.mjs` 下半部分 |
| **Application（应用层）** | Use Case 编排，不感知基础设施 | 各 `*.mjs` 入口文件 |

**规则：** 教程给出的"平铺脚本"代码，Claude 会按此分层重构后再融合，不直接使用教程的原始写法。

### 融合教程代码的流程

1. 检查 `shared.mjs` 是否已有可复用的接口/实现
2. 如有缺口（如缺少 `search` 方法），先扩展 `shared.mjs`
3. 新建入口文件，只写 Use Case + Bootstrap，所有技术细节留在 `shared.mjs`
4. 在 `package.json` 加对应的 `scripts` 命令

---

## mivlus 子项目

### 文件职责

| 文件 | 说明 |
|---|---|
| `shared.mjs` | 全部领域模型 + 基础设施实现 |
| `insert.mjs` | 插入日记数据 |
| `query.mjs` | 向量搜索日记 |
| `rag.mjs` | 日记 RAG 问答 |
| `insert-ebook.mjs` | 插入电子书（天龙八部）|
| `ebook-query.mjs` | 向量搜索电子书 |
| `ebook-rag.mjs` | 电子书 RAG 问答 |

### shared.mjs 领域模型速览

**日记域：**
- `DiaryEntry` — 实体
- `DiarySearchResult` — 值对象
- `DiaryEntryRepository` — 仓储接口
- `EmbeddingService` — 嵌入服务接口
- `LLMService` — LLM 服务接口
- `MilvusDiaryRepository` — 仓储实现（含 `setupStorage` / `saveAll` / `search`）
- `OpenAIEmbeddingService` — Embedding 实现
- `OpenAIChatService` — LLM 实现

**电子书域：**
- `EBookChunk` — 实体
- `EBookSearchResult` — 值对象
- `EBookRepository` — 仓储接口（含 `setupStorage` / `saveChapterChunks` / `search`）
- `MilvusEBookRepository` — 仓储实现

**工厂：**
- `createConnectedMilvusClient()` — 创建并连接 Milvus 客户端

### 启动命令

```bash
pnpm start          # 插入日记
pnpm query          # 搜索日记
pnpm rag            # 日记 RAG 问答
pnpm insert-ebook   # 插入电子书
pnpm query-ebook    # 搜索电子书
pnpm rag-ebook      # 电子书 RAG 问答
pnpm docker:up      # 启动 Milvus Docker
pnpm docker:health  # 检查 Milvus 健康状态
```

---

## memory-test 子项目

### 文件职责

| 文件 | 说明 |
|---|---|
| `shared.mjs` | 对话域领域模型 + 基础设施实现 |
| `history-test.mjs` | 多轮对话（InMemory 记忆）演示 |
| `file-history-test.mjs` | 多轮对话（FileSystem 持久化记忆）演示 |

### shared.mjs 领域模型速览

- `ConversationTurn` — 值对象（一条对话消息）
- `MessageHistoryRepository` — 历史记录仓储接口
- `LLMService` — LLM 服务接口
- `InMemoryMessageHistoryAdapter` — 基于 LangChain `InMemoryChatMessageHistory` 的实现
- `FileSystemMessageHistoryAdapter` — 基于 LangChain `FileSystemChatMessageHistory` 的实现，构造参数 `(filePath, sessionId)`，持久化到 JSON 文件，支持多会话共存
- `OpenAIChatService` — 基于 `ChatOpenAI` 的实现

### 启动命令

```bash
pnpm history        # 多轮对话 InMemory 记忆演示
pnpm file-history   # 多轮对话 FileSystem 持久化记忆演示
```

---

## 环境变量

`.env` 文件放在项目根目录（`guang-ai-course/.env`），各子项目通过 `node --env-file=../.env` 读取。

需要的变量：

```
OPENAI_API_KEY=
OPENAI_BASE_URL=
MODEL_NAME=
EMBEDDINGS_MODEL_NAME=
```
