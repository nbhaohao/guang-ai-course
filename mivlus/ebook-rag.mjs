import {
    OpenAIEmbeddingService,
    OpenAIChatService,
    MilvusEBookRepository,
    createConnectedMilvusClient
} from './shared.mjs';

// ============================================================
// APPLICATION LAYER  应用层
//
// RAG 流程：Retrieve → Augment → Generate
// 1. Retrieve  — 向量搜索从 Milvus 找到相关电子书片段
// 2. Augment   — 将片段拼成 context，注入到 prompt
// 3. Generate  — 让 LLM 根据 context 生成回答
// ============================================================

class AnswerEBookQuestionUseCase {
    /**
     * @param {import('./shared.mjs').EBookRepository} repository
     * @param {import('./shared.mjs').LLMService} llmService
     */
    constructor(repository, llmService) {
        this._repository = repository;
        this._llmService = llmService;
    }

    async execute(question, k = 3) {
        console.log('='.repeat(80));
        console.log(`问题: ${question}`);
        console.log('='.repeat(80));

        // ── Step 1: Retrieve ──────────────────────────────────
        console.log('\n【检索相关内容】');
        const results = await this._repository.search(question, k);

        if (results.length === 0) {
            console.log('未找到相关内容');
            return '抱歉，我没有找到相关的《天龙八部》内容。';
        }

        results.forEach((item, i) => {
            console.log(`\n[片段 ${i + 1}] 相似度: ${item.score.toFixed(4)}`);
            console.log(`书籍: ${item.book_id}`);
            console.log(`章节: 第 ${item.chapter_num} 章`);
            console.log(`片段索引: ${item.index}`);
            console.log(`内容: ${item.content.substring(0, 200)}${item.content.length > 200 ? '...' : ''}`);
        });

        // ── Step 2: Augment ───────────────────────────────────
        const context = results
            .map((item, i) =>
                `[片段 ${i + 1}]\n章节: 第 ${item.chapter_num} 章\n内容: ${item.content}`
            )
            .join('\n\n━━━━━\n\n');

        const prompt = `你是一个专业的《天龙八部》小说助手。基于小说内容回答问题，用准确、详细的语言。

请根据以下《天龙八部》小说片段内容回答问题：
${context}

用户问题: ${question}

回答要求：
1. 如果片段中有相关信息，请结合小说内容给出详细、准确的回答
2. 可以综合多个片段的内容，提供完整的答案
3. 如果片段中没有相关信息，请如实告知用户
4. 回答要准确，符合小说的情节和人物设定
5. 可以引用原文内容来支持你的回答

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
        const repository       = new MilvusEBookRepository(milvusClient, embeddingService);
        const useCase          = new AnswerEBookQuestionUseCase(repository, llmService);

        await useCase.execute('鸠摩智会什么武功？', 5);
    } catch (error) {
        console.error('错误:', error.message);
    }
}

main();
