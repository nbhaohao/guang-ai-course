import {MilvusClient, DataType, MetricType, IndexType} from '@zilliz/milvus2-sdk-node';
import {ChatOpenAI, OpenAIEmbeddings} from "@langchain/openai";

// ============================================================
// DOMAIN LAYER  领域层
// ============================================================

// 实体 (Entity) — 由 id 唯一标识
export class DiaryEntry {
    constructor({id, content, date, mood, tags}) {
        this.id = id;
        this.content = content;
        this.date = date;
        this.mood = mood;
        this.tags = tags;
    }
}

// 值对象 (Value Object) — 无唯一标识，由属性整体定义，不可变
// Unlike an Entity, a Value Object is defined by its attributes, not an id
export class DiarySearchResult {
    constructor({score, id, content, date, mood, tags}) {
        this.score = score;
        this.id = id;
        this.content = content;
        this.date = date;
        this.mood = mood;
        this.tags = tags;
    }
}

// 仓储接口 — 领域层声明需要哪些能力，不关心实现
export class DiaryEntryRepository {
    async setupStorage()           { throw new Error('Not implemented'); }
    async saveAll(entries)         { throw new Error('Not implemented'); }
    async search(queryText, limit) { throw new Error('Not implemented'); }
}

// 服务接口
export class EmbeddingService {
    async embed(text) { throw new Error('Not implemented'); }
}

// LLM 服务接口 — 领域层只知道"能问问题、得到回答"，不关心用哪个模型
export class LLMService {
    async chat(prompt) { throw new Error('Not implemented'); }
}

// ============================================================
// INFRASTRUCTURE LAYER  基础设施层
// ============================================================

export const COLLECTION_NAME = 'ai_diary';
export const VECTOR_DIM = 1024;

export class OpenAIChatService extends LLMService {
    constructor() {
        super();
        this._model = new ChatOpenAI({
            temperature: 0.7,
            model: process.env.MODEL_NAME,
            apiKey: process.env.OPENAI_API_KEY,
            configuration: {baseURL: process.env.OPENAI_BASE_URL}
        });
    }

    async chat(prompt) {
        const response = await this._model.invoke(prompt);
        return response.content;
    }
}

export class OpenAIEmbeddingService extends EmbeddingService {
    constructor() {
        super();
        this._client = new OpenAIEmbeddings({
            apiKey: process.env.OPENAI_API_KEY,
            model: process.env.EMBEDDINGS_MODEL_NAME,
            configuration: {baseURL: process.env.OPENAI_BASE_URL},
            dimensions: VECTOR_DIM
        });
    }

    async embed(text) {
        return this._client.embedQuery(text);
    }
}

export class MilvusDiaryRepository extends DiaryEntryRepository {
    constructor(milvusClient, embeddingService) {
        super();
        this._client = milvusClient;
        this._embeddingService = embeddingService;
    }

    async setupStorage() {
        console.log('Creating collection...');
        await this._client.createCollection({
            collection_name: COLLECTION_NAME,
            fields: [
                {name: 'id',      data_type: DataType.VarChar,    max_length: 50, is_primary_key: true},
                {name: 'vector',  data_type: DataType.FloatVector, dim: VECTOR_DIM},
                {name: 'content', data_type: DataType.VarChar,    max_length: 5000},
                {name: 'date',    data_type: DataType.VarChar,    max_length: 50},
                {name: 'mood',    data_type: DataType.VarChar,    max_length: 50},
                {
                    name: 'tags',
                    data_type: DataType.Array,
                    element_type: DataType.VarChar,
                    max_capacity: 10,
                    max_length: 50
                }
            ]
        });
        console.log('✓ Collection created');

        console.log('\nCreating index...');
        await this._client.createIndex({
            collection_name: COLLECTION_NAME,
            field_name: 'vector',
            index_type: IndexType.IVF_FLAT,
            metric_type: MetricType.COSINE,
            params: {nlist: 1024}
        });
        console.log('✓ Index created');

        console.log('\nLoading collection...');
        await this._client.loadCollection({collection_name: COLLECTION_NAME});
        console.log('✓ Collection loaded');
    }

    async saveAll(entries) {
        console.log('\nGenerating embeddings...');
        const records = await Promise.all(
            entries.map(async (entry) => ({
                id:      entry.id,
                content: entry.content,
                date:    entry.date,
                mood:    entry.mood,
                tags:    entry.tags,
                vector:  await this._embeddingService.embed(entry.content)
            }))
        );

        const result = await this._client.insert({
            collection_name: COLLECTION_NAME,
            data: records
        });
        return result.insert_cnt;
    }

    async search(queryText, limit = 2) {
        const queryVector = await this._embeddingService.embed(queryText);
        const result = await this._client.search({
            collection_name: COLLECTION_NAME,
            vector: queryVector,
            limit,
            metric_type: MetricType.COSINE,
            output_fields: ['id', 'content', 'date', 'mood', 'tags']
        });
        // 将 Milvus 返回的原始数据映射为领域值对象
        return result.results.map(item => new DiarySearchResult(item));
    }
}

// 工厂函数：统一创建并连接 Milvus 客户端
export async function createConnectedMilvusClient() {
    const client = new MilvusClient({address: 'localhost:19530'});
    await client.connectPromise;
    return client;
}
