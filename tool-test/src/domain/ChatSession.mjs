import { SystemMessage, HumanMessage } from '@langchain/core/messages';

// 领域层 — 聊天会话实体
// 只管消息状态，不依赖任何外部框架
export class ChatSession {
    constructor(systemPrompt) {
        this.messages = [new SystemMessage(systemPrompt)];
    }

    addHumanMessage(content) {
        this.messages.push(new HumanMessage(content));
    }

    addMessage(message) {
        this.messages.push(message);
    }

    getMessages() {
        return [...this.messages];
    }
}
