import {MilvusClient, DataType, MetricType, IndexType} from '@zilliz/milvus2-sdk-node';
import {OpenAIEmbeddings} from "@langchain/openai";

// ============================================================
// DOMAIN LAYER  领域层
//
// DDD 最核心的一层，描述业务"是什么"，不关心"怎么做"。
// The core of DDD — describes WHAT the business is, not HOW it works.
//
// 包含：实体 (Entity)、仓储接口 (Repository Interface)、服务接口 (Service Interface)
// ============================================================

/**
 * DiaryEntry — 领域实体 (Domain Entity)
 *
 * 实体由唯一 id 标识，而不是属性。即使 content 变了，只要 id 相同就是同一条日记。
 * An Entity is identified by its id, not its attributes.
 */
class DiaryEntry {
    constructor({id, content, date, mood, tags}) {
        this.id = id;
        this.content = content;
        this.date = date;
        this.mood = mood;
        this.tags = tags;
    }
}

/**
 * DiaryEntryRepository — 仓储接口 (Repository Interface)
 *
 * 领域层只定义"我需要什么能力"，不关心背后用的是 Milvus 还是其他数据库。
 * 具体实现放在基础设施层 → 这就是"依赖倒置原则 (DIP)"。
 *
 * The domain declares WHAT it needs; infrastructure decides HOW.
 * This is the Dependency Inversion Principle (DIP).
 */
class DiaryEntryRepository {
    async setupStorage() { throw new Error('Not implemented'); }
    async saveAll(entries) { throw new Error('Not implemented'); }
}

/**
 * EmbeddingService — 领域服务接口 (Domain Service Interface)
 *
 * 把文本转成向量是一种"能力"，领域层声明需要它，但不绑定具体实现（OpenAI / 其他模型）。
 * Declares the need to embed text without coupling to any specific provider.
 */
class EmbeddingService {
    async embed(text) { throw new Error('Not implemented'); }
}

// ============================================================
// INFRASTRUCTURE LAYER  基础设施层
//
// 实现领域层定义的接口，封装所有外部系统的细节（Milvus、OpenAI API 等）。
// Implements domain interfaces and handles all external system details.
// ============================================================

const COLLECTION_NAME = 'ai_diary';
const VECTOR_DIM = 1024;

/**
 * OpenAIEmbeddingService — EmbeddingService 的具体实现
 *
 * 基础设施层的实现细节对领域层完全透明。
 * 换成别的 Embedding 模型时，只需换掉这个类，领域层和应用层代码不用动。
 */
class OpenAIEmbeddingService extends EmbeddingService {
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

/**
 * MilvusDiaryRepository — DiaryEntryRepository 的具体实现
 *
 * 封装所有 Milvus 操作：建表、建索引、加载集合、批量插入。
 * 上层（应用层）只看到 setupStorage() 和 saveAll()，感知不到 Milvus 的存在。
 */
class MilvusDiaryRepository extends DiaryEntryRepository {
    // 通过构造函数注入依赖，方便测试时替换为 mock — 依赖注入 (Dependency Injection)
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
                {name: 'id',      data_type: DataType.VarChar,     max_length: 50, is_primary_key: true},
                {name: 'vector',  data_type: DataType.FloatVector,  dim: VECTOR_DIM},
                {name: 'content', data_type: DataType.VarChar,     max_length: 5000},
                {name: 'date',    data_type: DataType.VarChar,     max_length: 50},
                {name: 'mood',    data_type: DataType.VarChar,     max_length: 50},
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
        // 将领域实体转换为带向量的持久化格式（反腐层 Anti-Corruption Layer 的思想）
        // Convert domain entities into the storage format required by Milvus
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
}

// ============================================================
// APPLICATION LAYER  应用层
//
// 编排领域对象来完成一个具体用例 (Use Case)，不包含业务规则本身。
// Orchestrates domain objects to fulfil one specific use case.
// 只依赖接口（抽象），不依赖具体实现 → DIP 再次体现。
// ============================================================

/**
 * InsertDiaryEntriesUseCase — 用例 / 应用服务 (Application Service)
 *
 * 一个用例 = 一个业务动作（插入日记）。
 * 它的职责是：先建好存储，再批量保存，最后报告结果。
 * 它不知道底层用的是 Milvus，也不知道向量由 OpenAI 生成。
 */
class InsertDiaryEntriesUseCase {
    /** @param {DiaryEntryRepository} repository */
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
// BOOTSTRAP  启动层
//
// 唯一知道所有层具体实现的地方，负责"组装"整个应用。
// The only place that knows all concrete implementations — wires everything together.
// 这种模式叫"组合根 (Composition Root)"。
// ============================================================

// 领域数据：用领域实体表示，而不是裸对象
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
        const milvusClient = new MilvusClient({address: 'localhost:19530'});
        await milvusClient.connectPromise;
        console.log('✓ Connected\n');

        // 组合根：构建具体实现，逐层注入
        // Composition Root: build concrete impls, inject them layer by layer
        const embeddingService = new OpenAIEmbeddingService();
        const repository       = new MilvusDiaryRepository(milvusClient, embeddingService);
        const useCase          = new InsertDiaryEntriesUseCase(repository);

        await useCase.execute(diaryEntries);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();
