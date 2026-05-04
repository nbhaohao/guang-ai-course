import 'dotenv/config';
import {
    OpenAIEmbeddingService,
    OpenAIChatService,
    MilvusConversationRepository,
    ConversationRecord,
    InMemoryMessageHistoryAdapter,
    HumanMessage,
    createConnectedMilvusClient
} from './shared.mjs';

// ============================================================
// APPLICATION LAYER  应用层
//
// 检索增强记忆（RAG Memory）流程：
// 1. Retrieve  — 用向量搜索从 Milvus 找到语义相关的历史对话
// 2. Augment   — 将历史片段注入 prompt 作为上下文
// 3. Generate  — LLM 结合上下文生成回答
// 4. Persist   — 将新对话写回 Milvus，供后续轮次检索
// ============================================================

class RetrievalMemoryUseCase {
    /**
     * @param {import('./shared.mjs').ConversationVectorRepository} vectorRepository
     * @param {import('./shared.mjs').MessageHistoryRepository}     shortTermHistory
     * @param {import('./shared.mjs').LLMService}                   llmService
     */
    constructor(vectorRepository, shortTermHistory, llmService) {
        this._vectorRepository = vectorRepository;
        this._shortTermHistory = shortTermHistory;
        this._llmService       = llmService;
    }

    async execute(questions) {
        for (let i = 0; i < questions.length; i++) {
            const input = questions[i];
            console.log(`\n[第 ${i + 1} 轮对话]`);
            console.log(`用户: ${input}`);

            // ── Step 1: Retrieve ──────────────────────────────
            console.log('\n【检索相关历史对话】');
            const retrieved = await this._vectorRepository.search(input, 2);

            let contextBlock = '';
            if (retrieved.length > 0) {
                retrieved.forEach((conv, idx) => {
                    console.log(`\n[历史对话 ${idx + 1}] 相似度: ${conv.score.toFixed(4)}`);
                    console.log(`轮次: ${conv.round}`);
                    console.log(`内容: ${conv.content}`);
                });
                contextBlock = retrieved
                    .map((conv, idx) => `[历史对话 ${idx + 1}]\n轮次: ${conv.round}\n${conv.content}`)
                    .join('\n\n━━━━━\n\n');
            } else {
                console.log('未找到相关历史对话');
            }

            // ── Step 2: Augment + Generate ────────────────────
            const contextMessage = contextBlock
                ? new HumanMessage(`相关历史对话：\n${contextBlock}\n\n用户问题: ${input}`)
                : new HumanMessage(input);

            console.log('\n【AI 回答】');
            const response = await this._llmService.invoke([contextMessage]);
            console.log(`助手: ${response.content}`);

            // ── Step 3: Persist ───────────────────────────────
            const conversationText = `用户: ${input}\n助手: ${response.content}`;
            await this._vectorRepository.save(new ConversationRecord({
                id:        `conv_${Date.now()}_${i + 1}`,
                content:   conversationText,
                round:     i + 1,
                timestamp: new Date().toISOString()
            }));
            console.log('💾 已保存到 Milvus 向量数据库');

            await this._shortTermHistory.addUserMessage(input);
            await this._shortTermHistory.addAssistantMessage(response);
        }
    }
}

// ============================================================
// BOOTSTRAP  启动层 / 组合根
// ============================================================

const QUESTIONS = [
    '我之前提到的机器学习项目进展如何？',
    '我周末经常做什么？',
    '我的职业是什么？'
];

async function main() {
    try {
        console.log('连接到 Milvus...');
        const milvusClient = await createConnectedMilvusClient();
        console.log('✓ 已连接\n');

        const embeddingService = new OpenAIEmbeddingService();
        const llmService       = new OpenAIChatService();
        const vectorRepository = new MilvusConversationRepository(milvusClient, embeddingService);
        const shortTermHistory = new InMemoryMessageHistoryAdapter();
        const useCase          = new RetrievalMemoryUseCase(vectorRepository, shortTermHistory, llmService);

        await useCase.execute(QUESTIONS);
    } catch (error) {
        console.error('错误:', error.message);
    }
}

main();
