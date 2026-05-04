import 'dotenv/config';
import path from 'node:path';
import {
    FileSystemMessageHistoryAdapter,
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
        this._llmService        = llmService;
        this._historyRepository = historyRepository;
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
            console.log(`助手: ${response.content}`);
            if (this._historyRepository.filePath) {
                console.log(`✓ 对话已持久化到: ${this._historyRepository.filePath}\n`);
            }
        }
    }
}

// ============================================================
// BOOTSTRAP  启动层 / 组合根
// ============================================================

async function main() {
    try {
        const filePath  = path.join(process.cwd(), 'chat_history.json');
        const sessionId = 'user_session_001';

        const llmService        = new OpenAIChatService();
        const historyRepository = new FileSystemMessageHistoryAdapter(filePath, sessionId);
        const useCase           = new MultiTurnConversationUseCase(llmService, historyRepository);

        const systemPrompt = '你是一个友好的做菜助手，喜欢分享美食和烹饪技巧。';
        const userMessages = [
            '红烧肉怎么做',
            '好吃吗？'
        ];

        await useCase.execute(systemPrompt, userMessages);
    } catch (error) {
        console.error('错误:', error.message);
    }
}

main();
