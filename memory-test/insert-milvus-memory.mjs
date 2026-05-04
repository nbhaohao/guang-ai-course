import 'dotenv/config';
import {
    OpenAIEmbeddingService,
    MilvusConversationRepository,
    ConversationRecord,
    createConnectedMilvusClient
} from './shared.mjs';

// ============================================================
// APPLICATION LAYER  应用层
// ============================================================

class InsertConversationsUseCase {
    /** @param {import('./shared.mjs').ConversationVectorRepository} repository */
    constructor(repository) {
        this._repository = repository;
    }

    async execute(records) {
        await this._repository.setupStorage();

        console.log('\n插入对话数据...');
        const count = await this._repository.saveAll(records);
        console.log(`✓ 已插入 ${count} 条记录`);
    }
}

// ============================================================
// BOOTSTRAP  启动层 / 组合根
// ============================================================

const SEED_CONVERSATIONS = [
    { id: 'conv_001', content: '用户: 我叫赵六，是一名数据科学家\n助手: 很高兴认识你，赵六！数据科学是一个很有趣的领域。',     round: 1 },
    { id: 'conv_002', content: '用户: 我最近在研究机器学习算法\n助手: 机器学习确实很有意思，你在研究哪些算法呢？',           round: 2 },
    { id: 'conv_003', content: '用户: 我喜欢打篮球和看电影\n助手: 运动和文化娱乐都是很好的爱好！',                         round: 3 },
    { id: 'conv_004', content: '用户: 我周末经常去电影院\n助手: 看电影是很好的放松方式。',                               round: 4 },
    { id: 'conv_005', content: '用户: 我的职业是软件工程师\n助手: 软件工程师是个很有前景的职业！',                         round: 5 },
].map(data => new ConversationRecord({ ...data, timestamp: new Date().toISOString() }));

async function main() {
    try {
        console.log('连接到 Milvus...');
        const milvusClient = await createConnectedMilvusClient();
        console.log('✓ 已连接\n');

        const embeddingService = new OpenAIEmbeddingService();
        const repository       = new MilvusConversationRepository(milvusClient, embeddingService);
        const useCase          = new InsertConversationsUseCase(repository);

        await useCase.execute(SEED_CONVERSATIONS);

        console.log('\n' + '='.repeat(60));
        console.log('对话数据已写入 Milvus，可用于后续检索记忆演示');
        console.log('='.repeat(60));
    } catch (error) {
        console.error('错误:', error.message);
    }
}

main();
