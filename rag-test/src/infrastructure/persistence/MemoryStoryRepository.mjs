import { Document } from '@langchain/core/documents';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { RetrievedDocument } from '../../domain/story/RetrievedDocument.mjs';

export class MemoryStoryRepository {
    constructor(embeddings) {
        this.embeddings = embeddings;
        this.vectorStore = null;
    }

    async save(storyDocuments) {
        const langchainDocs = storyDocuments.map(doc => new Document({
            pageContent: doc.pageContent,
            metadata: {
                chapter: doc.chapter,
                character: doc.character,
                type: doc.type,
                mood: doc.mood,
            },
        }));
        this.vectorStore = await MemoryVectorStore.fromDocuments(langchainDocs, this.embeddings);
    }

    async findSimilar(question, limit = 3) {
        const scoredResults = await this.vectorStore.similaritySearchWithScore(question.text, limit);
        return scoredResults.map(([doc, score]) => new RetrievedDocument({
            document: { pageContent: doc.pageContent, ...doc.metadata },
            similarity: (1 - score).toFixed(4),
        }));
    }
}
