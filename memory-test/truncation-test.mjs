import 'dotenv/config';
import {
    InMemoryMessageHistoryAdapter,
    MessageCountTruncationStrategy,
    TokenCountTruncationStrategy,
    HumanMessage,
    AIMessage
} from './shared.mjs';

// ============================================================
// APPLICATION LAYER  应用层
// ============================================================

class DemoTruncationUseCase {
    /**
     * @param {import('./shared.mjs').MessageHistoryRepository} historyRepository
     * @param {import('./shared.mjs').TruncationStrategy} truncationStrategy
     */
    constructor(historyRepository, truncationStrategy) {
        this._historyRepository  = historyRepository;
        this._truncationStrategy = truncationStrategy;
    }

    async execute(rawMessages) {
        for (const { type, content } of rawMessages) {
            if (type === 'human') {
                await this._historyRepository.addUserMessage(content);
            } else {
                await this._historyRepository.addAssistantMessage(new AIMessage(content));
            }
        }

        const allMessages     = await this._historyRepository.getAll();
        const trimmedMessages = await this._truncationStrategy.truncate(allMessages);
        return { allMessages, trimmedMessages };
    }
}

// ============================================================
// BOOTSTRAP  启动层 / 组合根
// ============================================================

const MESSAGES_COUNT_DEMO = [
    { type: 'human', content: '我叫张三' },
    { type: 'ai',    content: '你好张三，很高兴认识你！' },
    { type: 'human', content: '我今年25岁' },
    { type: 'ai',    content: '25岁正是青春年华，有什么我可以帮助你的吗？' },
    { type: 'human', content: '我喜欢编程' },
    { type: 'ai',    content: '编程很有趣！你主要用什么语言？' },
    { type: 'human', content: '我住在北京' },
    { type: 'ai',    content: '北京是个很棒的城市！' },
    { type: 'human', content: '我的职业是软件工程师' },
    { type: 'ai',    content: '软件工程师是个很有前景的职业！' },
];

const MESSAGES_TOKEN_DEMO = [
    { type: 'human', content: '我叫李四' },
    { type: 'ai',    content: '你好李四，很高兴认识你！' },
    { type: 'human', content: '我是一名设计师' },
    { type: 'ai',    content: '设计师是个很有创造力的职业！你主要做什么类型的设计？' },
    { type: 'human', content: '我喜欢艺术和音乐' },
    { type: 'ai',    content: '艺术和音乐都是很好的爱好，它们能激发创作灵感。' },
    { type: 'human', content: '我擅长 UI/UX 设计' },
    { type: 'ai',    content: 'UI/UX 设计非常重要，好的用户体验能让产品更成功！' },
];

async function main() {
    try {
        // ── Demo 1: 按消息条数截断 ────────────────────────────
        console.log('========== 1. 按消息数量截断 ==========');
        const countStrategy = new MessageCountTruncationStrategy(4);
        const useCase1      = new DemoTruncationUseCase(
            new InMemoryMessageHistoryAdapter(),
            countStrategy
        );
        const { allMessages: all1, trimmedMessages: trimmed1 } =
            await useCase1.execute(MESSAGES_COUNT_DEMO);

        console.log(`原始消息数量: ${all1.length}，保留: ${trimmed1.length}`);
        console.log('保留的消息:');
        trimmed1.forEach(m => console.log(`  ${m.constructor.name}: ${m.content}`));

        // ── Demo 2: 按 token 数量截断 ─────────────────────────
        console.log('\n========== 2. 按 token 数量截断 ==========');
        const tokenStrategy = new TokenCountTruncationStrategy(100);
        const useCase2      = new DemoTruncationUseCase(
            new InMemoryMessageHistoryAdapter(),
            tokenStrategy
        );
        const { trimmedMessages: trimmed2 } =
            await useCase2.execute(MESSAGES_TOKEN_DEMO);

        const totalTokens = trimmed2.reduce(
            (sum, m) => sum + tokenStrategy.tokenCount(m), 0
        );
        console.log(`总 token 数: ${totalTokens}/100，保留消息数量: ${trimmed2.length}`);
        console.log('保留的消息:');
        trimmed2.forEach(m => {
            const tokens = tokenStrategy.tokenCount(m);
            console.log(`  ${m.constructor.name} (${tokens} tokens): ${m.content}`);
        });
    } catch (error) {
        console.error('错误:', error.message);
    }
}

main();
