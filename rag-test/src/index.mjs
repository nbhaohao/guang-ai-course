import path from 'path';
import {fileURLToPath} from 'url';
import dotenv from 'dotenv';
import fs from 'node:fs';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
    path.resolve(__dirname, '../../.env'),
    path.resolve(process.cwd(), '.env'),
];

const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));

if (envPath) {
    dotenv.config({ path: envPath });
} else {
    console.warn('[dotenv] .env file not found, continuing with existing process.env');
}


import {OpenAIEmbeddings} from '@langchain/openai';
import {AppConfig} from './infrastructure/config/AppConfig.mjs';
import {MemoryStoryRepository} from './infrastructure/persistence/MemoryStoryRepository.mjs';
import {WebArticleRepository} from './infrastructure/persistence/WebArticleRepository.mjs';
import {LangChainLanguageModel, PromptTemplates} from './infrastructure/ai/LangChainLanguageModel.mjs';
import {AnswerQuestionUseCase} from './application/AnswerQuestionUseCase.mjs';
import {storyDocuments} from './domain/story/storyCorpus.mjs';
import {Question} from './domain/story/Question.mjs';

const embeddings = new OpenAIEmbeddings({
    apiKey: AppConfig.openai.apiKey,
    model: AppConfig.openai.embeddingsModelName,
    configuration: {baseURL: AppConfig.openai.baseURL},
});

// ── Case 1: Story RAG ──────────────────────────────────────────────────────────
console.log('\n【Case 1: Story RAG】\n');

const storyRepository = new MemoryStoryRepository(embeddings);
await storyRepository.save(storyDocuments);

const storyLanguageModel = new LangChainLanguageModel(AppConfig.openai);
const answerStoryQuestion = new AnswerQuestionUseCase({
    repository: storyRepository,
    languageModel: storyLanguageModel,
});

for (const question of [new Question('东东和光光是怎么成为朋友的？')]) {
    console.log('='.repeat(80));
    console.log(`问题: ${question.text}`);
    console.log('='.repeat(80));

    const result = await answerStoryQuestion.execute(question);

    console.log('\n【检索到的文档及相似度评分】');
    result.retrievedDocuments.forEach((rd, i) => {
        console.log(`\n[文档 ${i + 1}] 相似度: ${rd.similarity}`);
        console.log(`内容: ${rd.document.pageContent}`);
        console.log(`元数据: 章节=${rd.document.chapter}, 角色=${rd.document.character}, 类型=${rd.document.type}, 心情=${rd.document.mood}`);
    });

    console.log('\n【AI 回答】');
    console.log(result.answer);
    console.log('\n');
}

// ── Case 2: Web Article RAG ───────────────────────────────────────────────────
console.log('\n【Case 2: Web Article RAG】\n');

const webArticleRepository = new WebArticleRepository(embeddings, {
    url: 'https://juejin.cn/post/7233327509919547452',
    selector: '.main-area p',
    chunkSize: 500,
    chunkOverlap: 50,
    separators: ['。', '！', '？'],
});
await webArticleRepository.load();

const articleLanguageModel = new LangChainLanguageModel({
    ...AppConfig.openai,
    promptTemplate: PromptTemplates.article,
});
const answerArticleQuestion = new AnswerQuestionUseCase({
    repository: webArticleRepository,
    languageModel: articleLanguageModel,
});

for (const question of [new Question('父亲的去世对作者的人生态度产生了怎样的根本性逆转？')]) {
    console.log('='.repeat(80));
    console.log(`问题: ${question.text}`);
    console.log('='.repeat(80));

    const result = await answerArticleQuestion.execute(question);

    console.log('\n【检索到的文档及相似度评分】');
    result.retrievedDocuments.forEach((rd, i) => {
        console.log(`\n[文档 ${i + 1}] 相似度: ${rd.similarity}`);
        console.log(`内容: ${rd.document.pageContent}`);
        if (rd.document && Object.keys(rd.document).filter(k => k !== 'pageContent').length > 0) {
            const { pageContent, ...meta } = rd.document;
            console.log('元数据:', meta);
        }
    });

    console.log('\n【AI 回答】');
    console.log(result.answer);
    console.log('\n');
}
