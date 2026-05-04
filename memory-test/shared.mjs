import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { HumanMessage, AIMessage, SystemMessage, trimMessages, getBufferString } from '@langchain/core/messages';
import { FileSystemChatMessageHistory } from '@langchain/community/stores/message/file_system';
import { MilvusClient, DataType, MetricType, IndexType } from '@zilliz/milvus2-sdk-node';
import { getEncoding } from 'js-tiktoken';

// ============================================================
// DOMAIN LAYER  领域层
// ============================================================

// 值对象 — 代表一条对话消息
export class ConversationTurn {
    constructor({ role, content }) {
        this.role    = role;    // 'user' | 'assistant'
        this.content = content;
    }
}

// 仓储接口 — 领域层声明需要什么能力，不关心实现
export class MessageHistoryRepository {
    async addUserMessage(content)      { throw new Error('Not implemented'); }
    async addAssistantMessage(message) { throw new Error('Not implemented'); }
    async getAll()                     { throw new Error('Not implemented'); }
    async clear()                      { throw new Error('Not implemented'); }
}

// LLM 服务接口
export class LLMService {
    async chat(systemPrompt, messages) { throw new Error('Not implemented'); }
    // 无系统提示直接传消息列表（用于 RAG 检索场景）
    async invoke(messages)             { throw new Error('Not implemented'); }
}

// 截断策略接口 — 接收完整消息列表，返回截断后的列表
export class TruncationStrategy {
    async truncate(messages) { throw new Error('Not implemented'); }
}

// 总结策略接口 — 接收将被丢弃的旧消息，返回总结文本
export class SummarizationStrategy {
    async summarize(messages) { throw new Error('Not implemented'); }
}

// ── 对话向量存储域 ──────────────────────────────────────────

// 实体
export class ConversationRecord {
    constructor({ id, content, round, timestamp }) {
        this.id        = id;
        this.content   = content;
        this.round     = round;
        this.timestamp = timestamp;
    }
}

// 值对象
export class ConversationSearchResult {
    constructor({ score, id, content, round, timestamp }) {
        this.score     = score;
        this.id        = id;
        this.content   = content;
        this.round     = round;
        this.timestamp = timestamp;
    }
}

// 嵌入服务接口
export class EmbeddingService {
    async embed(text) { throw new Error('Not implemented'); }
}

// 向量仓储接口
export class ConversationVectorRepository {
    async setupStorage()           { throw new Error('Not implemented'); }
    async saveAll(records)         { throw new Error('Not implemented'); }
    async save(record)             { throw new Error('Not implemented'); }
    async search(queryText, limit) { throw new Error('Not implemented'); }
}

// ============================================================
// INFRASTRUCTURE LAYER  基础设施层
// ============================================================

export class InMemoryMessageHistoryAdapter extends MessageHistoryRepository {
    constructor() {
        super();
        this._history = new InMemoryChatMessageHistory();
    }

    async addUserMessage(content) {
        await this._history.addMessage(new HumanMessage(content));
    }

    async addAssistantMessage(message) {
        await this._history.addMessage(message);
    }

    async getAll() {
        return this._history.getMessages();
    }

    async clear() {
        await this._history.clear();
    }
}

export class FileSystemMessageHistoryAdapter extends MessageHistoryRepository {
    /**
     * @param {string} filePath  JSON 文件路径
     * @param {string} sessionId 会话标识，支持多会话共存于同一文件
     */
    constructor(filePath, sessionId) {
        super();
        this._history = new FileSystemChatMessageHistory({ filePath, sessionId });
        this.filePath = filePath;
    }

    async addUserMessage(content) {
        await this._history.addMessage(new HumanMessage(content));
    }

    async addAssistantMessage(message) {
        await this._history.addMessage(message);
    }

    async getAll() {
        return this._history.getMessages();
    }

    async clear() {
        await this._history.clear();
    }
}

// 按消息条数截断：保留最近 maxMessages 条
export class MessageCountTruncationStrategy extends TruncationStrategy {
    constructor(maxMessages) {
        super();
        this._maxMessages = maxMessages;
    }

    async truncate(messages) {
        return messages.slice(-this._maxMessages);
    }
}

// 按 token 数量截断：使用 tiktoken 计数，保留最近不超过 maxTokens 的消息
export class TokenCountTruncationStrategy extends TruncationStrategy {
    constructor(maxTokens, encodingName = 'cl100k_base') {
        super();
        this._maxTokens = maxTokens;
        this._enc       = getEncoding(encodingName);
    }

    _countTokens(messages) {
        return messages.reduce((total, msg) => {
            const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            return total + this._enc.encode(text).length;
        }, 0);
    }

    async truncate(messages) {
        return trimMessages(messages, {
            maxTokens:    this._maxTokens,
            tokenCounter: (msgs) => this._countTokens(msgs),
            strategy:     'last'
        });
    }

    // 供入口文件展示用：计算单条消息的 token 数
    tokenCount(message) {
        const text = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
        return this._enc.encode(text).length;
    }
}

// 使用 LLM 对旧消息生成摘要
export class LLMSummarizationStrategy extends SummarizationStrategy {
    /** @param {LLMService} llmService */
    constructor(llmService) {
        super();
        this._llmService = llmService;
    }

    async summarize(messages) {
        if (messages.length === 0) return '';
        const conversationText = getBufferString(messages, {
            humanPrefix: '用户',
            aiPrefix:    '助手'
        });
        const summaryPrompt = `请总结以下对话的核心内容，保留重要信息：\n\n${conversationText}\n\n总结：`;
        const response = await this._llmService.chat(summaryPrompt, []);
        return response.content;
    }
}

export { HumanMessage, AIMessage };

export class OpenAIChatService extends LLMService {
    constructor() {
        super();
        this._model = new ChatOpenAI({
            modelName:     process.env.MODEL_NAME,
            apiKey:        process.env.OPENAI_API_KEY,
            temperature:   0,
            configuration: { baseURL: process.env.OPENAI_BASE_URL }
        });
    }

    async chat(systemPrompt, messages) {
        return this._model.invoke([new SystemMessage(systemPrompt), ...messages]);
    }

    async invoke(messages) {
        return this._model.invoke(messages);
    }
}

// ── 对话向量存储基础设施 ────────────────────────────────────

export const CONVERSATIONS_COLLECTION_NAME = 'conversations';
export const CONVERSATION_VECTOR_DIM       = 1024;

export class OpenAIEmbeddingService extends EmbeddingService {
    constructor() {
        super();
        this._client = new OpenAIEmbeddings({
            apiKey:        process.env.OPENAI_API_KEY,
            model:         process.env.EMBEDDINGS_MODEL_NAME,
            configuration: { baseURL: process.env.OPENAI_BASE_URL },
            dimensions:    CONVERSATION_VECTOR_DIM
        });
    }

    async embed(text) {
        return this._client.embedQuery(text);
    }
}

export class MilvusConversationRepository extends ConversationVectorRepository {
    constructor(milvusClient, embeddingService) {
        super();
        this._client           = milvusClient;
        this._embeddingService = embeddingService;
    }

    async setupStorage() {
        console.log('创建集合...');
        await this._client.createCollection({
            collection_name: CONVERSATIONS_COLLECTION_NAME,
            fields: [
                { name: 'id',        data_type: DataType.VarChar,    max_length: 50,   is_primary_key: true },
                { name: 'vector',    data_type: DataType.FloatVector, dim: CONVERSATION_VECTOR_DIM },
                { name: 'content',   data_type: DataType.VarChar,    max_length: 5000 },
                { name: 'round',     data_type: DataType.Int64 },
                { name: 'timestamp', data_type: DataType.VarChar,    max_length: 100 }
            ]
        });
        console.log('✓ 集合已创建');

        console.log('\n创建索引...');
        await this._client.createIndex({
            collection_name: CONVERSATIONS_COLLECTION_NAME,
            field_name:      'vector',
            index_type:      IndexType.IVF_FLAT,
            metric_type:     MetricType.COSINE
        });
        console.log('✓ 索引已创建');

        console.log('\n加载集合...');
        await this._client.loadCollection({ collection_name: CONVERSATIONS_COLLECTION_NAME });
        console.log('✓ 集合已加载');
    }

    async saveAll(records) {
        console.log('生成向量嵌入...');
        const data = await Promise.all(
            records.map(async (record) => ({
                ...record,
                vector: await this._embeddingService.embed(record.content)
            }))
        );
        const result = await this._client.insert({
            collection_name: CONVERSATIONS_COLLECTION_NAME,
            data
        });
        return Number(result.insert_cnt) || 0;
    }

    async save(record) {
        return this.saveAll([record]);
    }

    async search(queryText, limit = 2) {
        try {
            await this._client.loadCollection({ collection_name: CONVERSATIONS_COLLECTION_NAME });
        } catch (error) {
            if (!error.message.includes('already loaded')) throw error;
        }
        const queryVector = await this._embeddingService.embed(queryText);
        const result = await this._client.search({
            collection_name: CONVERSATIONS_COLLECTION_NAME,
            vector:          queryVector,
            limit,
            metric_type:     MetricType.COSINE,
            output_fields:   ['id', 'content', 'round', 'timestamp']
        });
        return result.results.map(item => new ConversationSearchResult(item));
    }
}

export async function createConnectedMilvusClient() {
    const client = new MilvusClient({ address: 'localhost:19530' });
    await client.connectPromise;
    return client;
}
