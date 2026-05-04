import {
    OpenAIEmbeddingService,
    MilvusEBookRepository,
    createConnectedMilvusClient
} from './shared.mjs';

// ============================================================
// APPLICATION LAYER  应用层
// ============================================================

class SearchEBookUseCase {
    /** @param {import('./shared.mjs').EBookRepository} repository */
    constructor(repository) {
        this._repository = repository;
    }

    /**
     * @param {string} queryText
     * @param {number} limit
     * @returns {Promise<import('./shared.mjs').EBookSearchResult[]>}
     */
    async execute(queryText, limit = 3) {
        return this._repository.search(queryText, limit);
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
        const repository       = new MilvusEBookRepository(milvusClient, embeddingService);
        const useCase          = new SearchEBookUseCase(repository);

        const query = '段誉会什么武功？';
        console.log(`Searching: "${query}"\n`);

        const results = await useCase.execute(query, 3);

        console.log(`Found ${results.length} results:\n`);
        results.forEach((item, index) => {
            console.log(`${index + 1}. [Score: ${item.score.toFixed(4)}]`);
            console.log(`   ID: ${item.id}`);
            console.log(`   Book ID: ${item.book_id}`);
            console.log(`   Chapter: 第 ${item.chapter_num} 章`);
            console.log(`   Index: ${item.index}`);
            console.log(`   Content: ${item.content}\n`);
        });
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();
