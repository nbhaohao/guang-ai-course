import {
    OpenAIEmbeddingService,
    MilvusDiaryRepository,
    createConnectedMilvusClient
} from './shared.mjs';

// ============================================================
// APPLICATION LAYER  应用层
// ============================================================

class SearchDiaryEntriesUseCase {
    /** @param {import('./shared.mjs').DiaryEntryRepository} repository */
    constructor(repository) {
        this._repository = repository;
    }

    /**
     * @param {string} queryText
     * @param {number} limit
     * @returns {Promise<import('./shared.mjs').DiarySearchResult[]>}
     */
    async execute(queryText, limit = 2) {
        const results = await this._repository.search(queryText, limit);
        return results;
    }
}

// ============================================================
// BOOTSTRAP  启动层 / 组合根
// ============================================================

async function main() {
    try {
        console.log('Connecting to Milvus...');
        const milvusClient = await createConnectedMilvusClient();
        console.log('✓ Connected\n');

        const embeddingService = new OpenAIEmbeddingService();
        const repository       = new MilvusDiaryRepository(milvusClient, embeddingService);
        const useCase          = new SearchDiaryEntriesUseCase(repository);

        const query = '我想看看关于户外活动的日记';
        console.log(`Searching: "${query}"\n`);

        const results = await useCase.execute(query, 2);

        console.log(`Found ${results.length} results:\n`);
        results.forEach((item, index) => {
            console.log(`${index + 1}. [Score: ${item.score.toFixed(4)}]`);
            console.log(`   ID: ${item.id}`);
            console.log(`   Date: ${item.date}`);
            console.log(`   Mood: ${item.mood}`);
            console.log(`   Tags: ${item.tags?.join(', ')}`);
            console.log(`   Content: ${item.content}\n`);
        });
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();
