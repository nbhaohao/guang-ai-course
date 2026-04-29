import {
    OpenAIEmbeddingService,
    OpenAIChatService,
    MilvusDiaryRepository,
    createConnectedMilvusClient
} from './shared.mjs';

// ============================================================
// APPLICATION LAYER  应用层
//
// RAG 的核心流程：Retrieve → Augment → Generate
// 1. Retrieve  — 用向量搜索从 Milvus 找到相关日记
// 2. Augment   — 将检索到的日记拼成 context，注入到 prompt
// 3. Generate  — 让 LLM 根据 context 生成回答
//
// 这三步全在用例里编排，领域层和基础设施层感知不到彼此。
// ============================================================

class AnswerDiaryQuestionUseCase {
    /**
     * @param {import('./shared.mjs').DiaryEntryRepository} repository
     * @param {import('./shared.mjs').LLMService} llmService
     */
    constructor(repository, llmService) {
        this._repository = repository;
        this._llmService = llmService;
    }

    async execute(question, k = 2) {
        console.log('='.repeat(80));
        console.log(`问题: ${question}`);
        console.log('='.repeat(80));

        // ── Step 1: Retrieve ──────────────────────────────────
        console.log('\n【检索相关日记】');
        const results = await this._repository.search(question, k);

        if (results.length === 0) {
            console.log('未找到相关日记');
            return '抱歉，我没有找到相关的日记内容。';
        }

        results.forEach((item, i) => {
            console.log(`\n[日记 ${i + 1}] 相似度: ${item.score.toFixed(4)}`);
            console.log(`日期: ${item.date}  心情: ${item.mood}  标签: ${item.tags?.join(', ')}`);
            console.log(`内容: ${item.content}`);
        });

        // ── Step 2: Augment ───────────────────────────────────
        // 把检索结果格式化成 LLM 能理解的文本 context
        const context = results
            .map((item, i) =>
                `[日记 ${i + 1}]\n日期: ${item.date}\n心情: ${item.mood}\n标签: ${item.tags?.join(', ')}\n内容: ${item.content}`
            )
            .join('\n\n━━━━━\n\n');

        const prompt = `你是一个温暖贴心的 AI 日记助手。基于用户的日记内容回答问题，用亲切自然的语言。

请根据以下日记内容回答问题：
${context}

用户问题: ${question}

回答要求：
1. 如果日记中有相关信息，请结合日记内容给出详细、温暖的回答
2. 可以总结多篇日记的内容，找出共同点或趋势
3. 如果日记中没有相关信息，请温和地告知用户
4. 用第二人称"你"来称呼日记的作者
5. 回答要有同理心，让用户感到被理解和关心

AI 助手的回答:`;

        // ── Step 3: Generate ──────────────────────────────────
        console.log('\n【AI 回答】');
        const answer = await this._llmService.chat(prompt);
        console.log(answer);
        console.log();

        return answer;
    }
}

// ============================================================
// BOOTSTRAP  启动层 / 组合根
// ============================================================

async function main() {
    try {
        console.log('连接到 Milvus...');
        const milvusClient = await createConnectedMilvusClient();
        console.log('✓ 已连接\n');

        const embeddingService = new OpenAIEmbeddingService();
        const llmService       = new OpenAIChatService();
        const repository       = new MilvusDiaryRepository(milvusClient, embeddingService);
        const useCase          = new AnswerDiaryQuestionUseCase(repository, llmService);

        await useCase.execute('我最近做了什么让我感到快乐的事情？', 2);
    } catch (error) {
        console.error('错误:', error.message);
    }
}

main();
