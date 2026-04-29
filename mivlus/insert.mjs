import {
    DiaryEntry,
    OpenAIEmbeddingService,
    MilvusDiaryRepository,
    createConnectedMilvusClient
} from './shared.mjs';

// ============================================================
// APPLICATION LAYER  应用层
// ============================================================

class InsertDiaryEntriesUseCase {
    /** @param {import('./shared.mjs').DiaryEntryRepository} repository */
    constructor(repository) {
        this._repository = repository;
    }

    /** @param {DiaryEntry[]} entries */
    async execute(entries) {
        await this._repository.setupStorage();
        const count = await this._repository.saveAll(entries);
        console.log(`\n✓ Inserted ${count} records`);
    }
}

// ============================================================
// BOOTSTRAP  启动层 / 组合根
// ============================================================

const diaryEntries = [
    new DiaryEntry({
        id: 'diary_001',
        content: '今天天气很好，去公园散步了，心情愉快。看到了很多花开了，春天真美好。',
        date: '2026-01-10', mood: 'happy', tags: ['生活', '散步']
    }),
    new DiaryEntry({
        id: 'diary_002',
        content: '今天工作很忙，完成了一个重要的项目里程碑。团队合作很愉快，感觉很有成就感。',
        date: '2026-01-11', mood: 'excited', tags: ['工作', '成就']
    }),
    new DiaryEntry({
        id: 'diary_003',
        content: '周末和朋友去爬山，天气很好，心情也很放松。享受大自然的感觉真好。',
        date: '2026-01-12', mood: 'relaxed', tags: ['户外', '朋友']
    }),
    new DiaryEntry({
        id: 'diary_004',
        content: '今天学习了 Milvus 向量数据库，感觉很有意思。向量搜索技术真的很强大。',
        date: '2026-01-12', mood: 'curious', tags: ['学习', '技术']
    }),
    new DiaryEntry({
        id: 'diary_005',
        content: '晚上做了一顿丰盛的晚餐，尝试了新菜谱。家人都说很好吃，很有成就感。',
        date: '2026-01-13', mood: 'proud', tags: ['美食', '家庭']
    }),
];

async function main() {
    try {
        console.log('Connecting to Milvus...');
        const milvusClient = await createConnectedMilvusClient();
        console.log('✓ Connected\n');

        const embeddingService = new OpenAIEmbeddingService();
        const repository       = new MilvusDiaryRepository(milvusClient, embeddingService);
        const useCase          = new InsertDiaryEntriesUseCase(repository);

        await useCase.execute(diaryEntries);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();
