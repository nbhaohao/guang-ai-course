import 'dotenv/config';
import {
    InMemoryMessageHistoryAdapter,
    OpenAIChatService,
    LLMSummarizationStrategy,
    HumanMessage,
    AIMessage
} from './shared.mjs';

// ============================================================
// APPLICATION LAYER  应用层
// ============================================================

class SummarizationMemoryUseCase {
    /**
     * @param {import('./shared.mjs').MessageHistoryRepository} historyRepository
     * @param {import('./shared.mjs').SummarizationStrategy}   summarizationStrategy
     * @param {number} maxMessages   超过此条数时触发总结
     * @param {number} keepRecent    触发总结后保留最近几条
     */
    constructor(historyRepository, summarizationStrategy, maxMessages = 6, keepRecent = 2) {
        this._historyRepository      = historyRepository;
        this._summarizationStrategy  = summarizationStrategy;
        this._maxMessages            = maxMessages;
        this._keepRecent             = keepRecent;
    }

    async execute(rawMessages) {
        for (const { type, content } of rawMessages) {
            if (type === 'human') {
                await this._historyRepository.addUserMessage(content);
            } else {
                await this._historyRepository.addAssistantMessage(new AIMessage(content));
            }
        }

        const allMessages = await this._historyRepository.getAll();

        if (allMessages.length < this._maxMessages) {
            return { allMessages, triggered: false };
        }

        const recentMessages      = allMessages.slice(-this._keepRecent);
        const messagesToSummarize = allMessages.slice(0, -this._keepRecent);

        const summary = await this._summarizationStrategy.summarize(messagesToSummarize);

        await this._historyRepository.clear();
        for (const msg of recentMessages) {
            if (msg instanceof HumanMessage) {
                await this._historyRepository.addUserMessage(msg.content);
            } else {
                await this._historyRepository.addAssistantMessage(msg);
            }
        }

        return { allMessages, triggered: true, messagesToSummarize, recentMessages, summary };
    }
}

// ============================================================
// BOOTSTRAP  启动层 / 组合根
// ============================================================

const RAW_MESSAGES = [
    { type: 'human', content: '我想学做红烧肉，你能教我吗？' },
    { type: 'ai',    content: '当然可以！红烧肉是一道经典的中式菜肴。首先需要准备五花肉、冰糖、生抽、老抽、料酒等材料。' },
    { type: 'human', content: '五花肉需要切多大块？' },
    { type: 'ai',    content: '建议切成3-4厘米见方的块，这样既容易入味，口感也更好。切好后可以用开水焯一下去除血沫。' },
    { type: 'human', content: '炒糖色的时候有什么技巧吗？' },
    { type: 'ai',    content: '炒糖色是关键步骤。用小火慢慢炒，等冰糖完全融化变成焦糖色，冒小泡时就可以下肉了。注意不要炒过头，否则会发苦。' },
    { type: 'human', content: '需要炖多长时间？' },
    { type: 'ai',    content: '一般需要炖40-60分钟，用小火慢炖，直到肉变得软糯入味。可以用筷子戳一下，能轻松戳透就说明好了。' },
    { type: 'human', content: '最后收汁的时候要注意什么？' },
    { type: 'ai',    content: '收汁时要用大火，不断翻动，让汤汁均匀包裹在肉块上。看到汤汁变得浓稠，颜色红亮就可以出锅了。' },
];

async function main() {
    try {
        const llmService            = new OpenAIChatService();
        const summarizationStrategy = new LLMSummarizationStrategy(llmService);
        const historyRepository     = new InMemoryMessageHistoryAdapter();
        const useCase               = new SummarizationMemoryUseCase(
            historyRepository, summarizationStrategy, 6, 2
        );

        const result = await useCase.execute(RAW_MESSAGES);

        console.log(`原始消息数量: ${result.allMessages.length}`);
        console.log('原始消息:');
        result.allMessages.forEach(m =>
            console.log(`  ${m.constructor.name}: ${m.content}`)
        );

        if (result.triggered) {
            console.log('\n💡 历史消息过多，触发总结...');
            console.log(`📝 被总结的消息数量: ${result.messagesToSummarize.length}`);
            console.log(`📝 保留的消息数量: ${result.recentMessages.length}`);
            console.log('\n保留的消息:');
            result.recentMessages.forEach(m =>
                console.log(`  ${m.constructor.name}: ${m.content}`)
            );
            console.log(`\n总结内容: ${result.summary}`);
        } else {
            console.log('\n消息数量未超过阈值，无需总结');
        }
    } catch (error) {
        console.error('错误:', error.message);
    }
}

main();
