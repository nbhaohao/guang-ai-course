import { ChatOpenAI } from '@langchain/openai';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { HumanMessage, AIMessage, SystemMessage, trimMessages } from '@langchain/core/messages';
import { FileSystemChatMessageHistory } from '@langchain/community/stores/message/file_system';
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
}

// LLM 服务接口
export class LLMService {
    async chat(systemPrompt, messages) { throw new Error('Not implemented'); }
}

// 截断策略接口 — 接收完整消息列表，返回截断后的列表
export class TruncationStrategy {
    async truncate(messages) { throw new Error('Not implemented'); }
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
}
