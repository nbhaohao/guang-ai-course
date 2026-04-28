import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { RetrievedDocument } from '../../domain/story/RetrievedDocument.mjs';

export class WebArticleRepository {
    constructor(embeddings, { url, selector, chunkSize = 500, chunkOverlap = 50, separators = ['。', '！', '？'] } = {}) {
        this.embeddings = embeddings;
        this.url = url;
        this.selector = selector;
        this.chunkSize = chunkSize;
        this.chunkOverlap = chunkOverlap;
        this.separators = separators;
        this.vectorStore = null;
    }

    async load() {
        const loader = new CheerioWebBaseLoader(this.url, { selector: this.selector });
        const rawDocs = await loader.load();

        console.log(`Total characters: ${rawDocs[0]?.pageContent.length ?? 0}`);

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: this.chunkSize,
            chunkOverlap: this.chunkOverlap,
            separators: this.separators,
        });

        const splitDocs = await splitter.splitDocuments(rawDocs);
        console.log(`文档分割完成，共 ${splitDocs.length} 个分块\n`);

        console.log('正在创建向量存储...');
        this.vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, this.embeddings);
        console.log('向量存储创建完成\n');
    }

    async findSimilar(question, limit = 2) {
        const scoredResults = await this.vectorStore.similaritySearchWithScore(question.text, limit);
        return scoredResults.map(([doc, score]) => new RetrievedDocument({
            document: { pageContent: doc.pageContent, ...doc.metadata },
            similarity: (1 - score).toFixed(4),
        }));
    }
}
