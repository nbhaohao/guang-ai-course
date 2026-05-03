import {parse} from 'path';
import {EPubLoader} from '@langchain/community/document_loaders/fs/epub';
import {RecursiveCharacterTextSplitter} from '@langchain/textsplitters';
import {
    OpenAIEmbeddingService,
    MilvusEBookRepository,
    createConnectedMilvusClient
} from './shared.mjs';

const EPUB_FILE  = './天龙八部.epub';
const CHUNK_SIZE = 500;
const BOOK_NAME  = parse(EPUB_FILE).name;

// ============================================================
// APPLICATION LAYER  应用层
// ============================================================

class ProcessEPubUseCase {
    /** @param {import('./shared.mjs').EBookRepository} repository */
    constructor(repository) {
        this._repository = repository;
    }

    async execute(bookId, epubFile, bookName) {
        await this._repository.setupStorage();

        console.log(`\nLoading EPUB: ${epubFile}`);
        const loader    = new EPubLoader(epubFile, {splitChapters: true});
        const documents = await loader.load();
        console.log(`✓ Loaded ${documents.length} chapters\n`);

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize:    CHUNK_SIZE,
            chunkOverlap: 50
        });

        let totalInserted = 0;

        for (let i = 0; i < documents.length; i++) {
            const chapterNum = i + 1;
            const chunks     = await splitter.splitText(documents[i].pageContent);

            if (chunks.length === 0) {
                console.log(`Chapter ${chapterNum}: empty, skipped`);
                continue;
            }

            console.log(`Chapter ${chapterNum}/${documents.length}: ${chunks.length} chunks, inserting...`);
            const count = await this._repository.saveChapterChunks(chunks, bookId, bookName, chapterNum);
            totalInserted += count;
            console.log(`  ✓ Inserted ${count} records (total: ${totalInserted})`);
        }

        console.log(`\n✓ Total inserted: ${totalInserted} records`);
    }
}

// ============================================================
// BOOTSTRAP  启动层 / 组合根
// ============================================================

async function main() {
    try {
        console.log('='.repeat(80));
        console.log('电子书处理程序');
        console.log('='.repeat(80));

        console.log('\nConnecting to Milvus...');
        const milvusClient = await createConnectedMilvusClient();
        console.log('✓ Connected\n');

        const embeddingService = new OpenAIEmbeddingService();
        const repository       = new MilvusEBookRepository(milvusClient, embeddingService);
        const useCase          = new ProcessEPubUseCase(repository);

        await useCase.execute('1', EPUB_FILE, BOOK_NAME);

        console.log('\n' + '='.repeat(80));
        console.log('处理完成！');
        console.log('='.repeat(80));
    } catch (error) {
        console.error('\nError:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
