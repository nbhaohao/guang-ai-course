import { ChatOpenAI } from '@langchain/openai';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { FileSystemChatMessageHistory } from '@langchain/community/stores/message/file_system';

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
