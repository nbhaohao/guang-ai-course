import 'dotenv/config';
import {
    InMemoryMessageHistoryAdapter,
    OpenAIChatService
} from './shared.mjs';

// ============================================================
// APPLICATION LAYER  应用层
// ============================================================

class MultiTurnConversationUseCase {
    /**
     * @param {import('./shared.mjs').LLMService} llmService
     * @param {import('./shared.mjs').MessageHistoryRepository} historyRepository
     */
    constructor(llmService, historyRepository) {
        this._llmService         = llmService;
        this._historyRepository  = historyRepository;
    }

    async execute(systemPrompt, userMessages) {
        for (let i = 0; i < userMessages.length; i++) {
            console.log(`[第 ${i + 1} 轮对话]`);

            const userContent = userMessages[i];
            await this._historyRepository.addUserMessage(userContent);

            const allMessages = await this._historyRepository.getAll();
            const response    = await this._llmService.chat(systemPrompt, allMessages);
            await this._historyRepository.addAssistantMessage(response);

            console.log(`用户: ${userContent}`);
            console.log(`助手: ${response.content}\n`);
        }

        // 展示完整历史
        console.log('[历史消息记录]');
        const allMessages = await this._historyRepository.getAll();
        console.log(`共保存了 ${allMessages.length} 条消息：`);
        allMessages.forEach((msg, index) => {
            const prefix = msg.getType() === 'human' ? '用户' : '助手';
            console.log(`  ${index + 1}. [${prefix}]: ${msg.content.substring(0, 50)}...`);
        });
    }
}

// ============================================================
// BOOTSTRAP  启动层 / 组合根
// ============================================================

async function main() {
    try {
        const llmService        = new OpenAIChatService();
        const historyRepository = new InMemoryMessageHistoryAdapter();
        const useCase           = new MultiTurnConversationUseCase(llmService, historyRepository);

        const systemPrompt = '你是一个友好、幽默的做菜助手，喜欢分享美食和烹饪技巧。';
        const userMessages = [
            '你今天吃的什么？',
            '好吃吗？'
        ];

        await useCase.execute(systemPrompt, userMessages);
    } catch (error) {
        console.error('错误:', error.message);
    }
}

main();
